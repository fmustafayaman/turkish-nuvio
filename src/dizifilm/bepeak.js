// Bepeak / vidmixi (dosyaload) player'ı, oynatma ayarlarını CryptoJS.AES ile
// şifreler: sayfada `bePlayer('<passphrase>', '{"ct":..,"iv":..,"s":..}')`
// çağrısı var. Şifreleme OpenSSL uyumlu (passphrase + salt → EVP_BytesToKey
// MD5 ile key+iv türetir, AES-256-CBC). Nuvio Hermes runtime'ında crypto-js
// veya Node crypto GARANTİ DEĞİL; bu yüzden MD5 + AES-CBC saf JS ile yazıldı.

import { SITE_HEADERS } from './constants.js';
import { timeoutSignal } from '../shared/http.js';
import { decodeBase64Bytes } from '../shared/base64.js';
import { detectHlsQuality } from '../shared/hls.js';

// --- MD5 (RFC 1321) ---------------------------------------------------------
function md5(bytes) {
    function rol(x, c) { return (x << c) | (x >>> (32 - c)); }
    function add(a, b) { return (a + b) & 0xffffffff; }

    const s = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];
    const K = [];
    for (let i = 0; i < 64; i++) {
        K[i] = (Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)) & 0xffffffff;
    }

    const msgLen = bytes.length;
    const bitLen = msgLen * 8;
    // Padding: 0x80, sonra 0'lar, son 8 byte little-endian bit uzunluğu.
    let padded = msgLen + 1;
    while (padded % 64 !== 56) padded++;
    const buf = new Uint8Array(padded + 8);
    buf.set(bytes);
    buf[msgLen] = 0x80;
    for (let i = 0; i < 8; i++) {
        buf[padded + i] = (bitLen / Math.pow(2, 8 * i)) & 0xff;
    }

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

    for (let off = 0; off < buf.length; off += 64) {
        const M = [];
        for (let i = 0; i < 16; i++) {
            M[i] = buf[off + i * 4] | (buf[off + i * 4 + 1] << 8) |
                (buf[off + i * 4 + 2] << 16) | (buf[off + i * 4 + 3] << 24);
        }
        let A = a0, B = b0, C = c0, D = d0;
        for (let i = 0; i < 64; i++) {
            let F, g;
            if (i < 16) { F = (B & C) | (~B & D); g = i; }
            else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
            else { F = C ^ (B | ~D); g = (7 * i) % 16; }
            F = add(add(add(F, A), K[i]), M[g]);
            A = D; D = C; C = B;
            B = add(B, rol(F, s[i]));
        }
        a0 = add(a0, A); b0 = add(b0, B); c0 = add(c0, C); d0 = add(d0, D);
    }

    const out = new Uint8Array(16);
    [a0, b0, c0, d0].forEach((v, i) => {
        out[i * 4] = v & 0xff;
        out[i * 4 + 1] = (v >>> 8) & 0xff;
        out[i * 4 + 2] = (v >>> 16) & 0xff;
        out[i * 4 + 3] = (v >>> 24) & 0xff;
    });
    return out;
}

// --- EVP_BytesToKey (OpenSSL, MD5) -----------------------------------------
function evpBytesToKey(passBytes, saltBytes, keyLen, ivLen) {
    const target = keyLen + ivLen;
    let derived = new Uint8Array(0);
    let prev = new Uint8Array(0);
    while (derived.length < target) {
        const input = new Uint8Array(prev.length + passBytes.length + saltBytes.length);
        input.set(prev, 0);
        input.set(passBytes, prev.length);
        input.set(saltBytes, prev.length + passBytes.length);
        prev = md5(input);
        const merged = new Uint8Array(derived.length + prev.length);
        merged.set(derived, 0);
        merged.set(prev, derived.length);
        derived = merged;
    }
    return { key: derived.slice(0, keyLen), iv: derived.slice(keyLen, keyLen + ivLen) };
}

// --- AES-256 blok çözme -----------------------------------------------------
const SBOX = new Uint8Array(256);
const INV_SBOX = new Uint8Array(256);
(function initSbox() {
    let p = 1, q = 1;
    do {
        p = p ^ (p << 1) ^ (p & 0x80 ? 0x11b : 0);
        p &= 0xff;
        q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 0xff;
        if (q & 0x80) q ^= 0x09;
        const xformed = q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4);
        SBOX[p] = (xformed ^ 0x63) & 0xff;
    } while (p !== 1);
    SBOX[0] = 0x63;
    for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;
    function rotl8(x, shift) { return ((x << shift) | (x >>> (8 - shift))) & 0xff; }
})();

function xtime(x) { return ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff; }
function mul(a, b) {
    let r = 0;
    for (let i = 0; i < 8; i++) {
        if (b & 1) r ^= a;
        const hi = a & 0x80;
        a = (a << 1) & 0xff;
        if (hi) a ^= 0x1b;
        b >>= 1;
    }
    return r & 0xff;
}

function expandKey(key) {
    // 256-bit anahtar → 60 word (15 round key).
    const Nk = 8, Nr = 14, Nb = 4;
    const w = new Array(Nb * (Nr + 1));
    for (let i = 0; i < Nk; i++) {
        w[i] = [key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]];
    }
    const rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d];
    for (let i = Nk; i < Nb * (Nr + 1); i++) {
        let temp = w[i - 1].slice();
        if (i % Nk === 0) {
            temp = [temp[1], temp[2], temp[3], temp[0]].map(b => SBOX[b]);
            temp[0] ^= rcon[i / Nk - 1];
        } else if (i % Nk === 4) {
            temp = temp.map(b => SBOX[b]);
        }
        w[i] = w[i - Nk].map((b, j) => b ^ temp[j]);
    }
    return w;
}

function decryptBlock(block, w) {
    const Nr = 14, Nb = 4;
    let state = [];
    for (let i = 0; i < 16; i++) state[i] = block[i];

    function addRoundKey(round) {
        for (let c = 0; c < Nb; c++) {
            for (let r = 0; r < 4; r++) {
                state[r + 4 * c] ^= w[round * Nb + c][r];
            }
        }
    }
    function invShiftRows() {
        const t = state.slice();
        for (let r = 1; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                state[r + 4 * ((c + r) % 4)] = t[r + 4 * c];
            }
        }
    }
    function invSubBytes() {
        for (let i = 0; i < 16; i++) state[i] = INV_SBOX[state[i]];
    }
    function invMixColumns() {
        for (let c = 0; c < 4; c++) {
            const s0 = state[4 * c], s1 = state[4 * c + 1], s2 = state[4 * c + 2], s3 = state[4 * c + 3];
            state[4 * c] = mul(s0, 14) ^ mul(s1, 11) ^ mul(s2, 13) ^ mul(s3, 9);
            state[4 * c + 1] = mul(s0, 9) ^ mul(s1, 14) ^ mul(s2, 11) ^ mul(s3, 13);
            state[4 * c + 2] = mul(s0, 13) ^ mul(s1, 9) ^ mul(s2, 14) ^ mul(s3, 11);
            state[4 * c + 3] = mul(s0, 11) ^ mul(s1, 13) ^ mul(s2, 9) ^ mul(s3, 14);
        }
    }

    // state kolonlar halinde tutuluyor; AES sütun-major olduğu için map düz.
    addRoundKey(Nr);
    for (let round = Nr - 1; round >= 1; round--) {
        invShiftRows();
        invSubBytes();
        addRoundKey(round);
        invMixColumns();
    }
    invShiftRows();
    invSubBytes();
    addRoundKey(0);

    return state;
}

function aesCbcDecrypt(key, iv, cipher) {
    const w = expandKey(key);
    const out = new Uint8Array(cipher.length);
    let prev = iv;
    for (let off = 0; off < cipher.length; off += 16) {
        const block = cipher.slice(off, off + 16);
        const dec = decryptBlock(block, w);
        for (let i = 0; i < 16; i++) out[off + i] = dec[i] ^ prev[i];
        prev = block;
    }
    // PKCS7 unpad
    const pad = out[out.length - 1];
    if (pad > 0 && pad <= 16) return out.slice(0, out.length - pad);
    return out;
}

// --- Yardımcılar ------------------------------------------------------------
function utf8Bytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
        else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    return new Uint8Array(out);
}

function hexBytes(hex) {
    const clean = String(hex || '').replace(/[^0-9a-fA-F]/g, '');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
}

function bytesToUtf8(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length;) {
        const b = bytes[i];
        if (b < 0x80) { out += String.fromCharCode(b); i += 1; }
        else if (b < 0xe0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
        else { out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
    }
    return out;
}

// CryptoJS.AES.decrypt(setJson, passphrase, {format: openssl-salt}) eşdeğeri.
export function decryptBePlayer(passphrase, setJson) {
    let parsed;
    try { parsed = JSON.parse(setJson); } catch { return null; }
    if (!parsed || !parsed.ct || !parsed.s) return null;

    const cipher = decodeBase64Bytes(parsed.ct);
    const salt = hexBytes(parsed.s);
    const pass = utf8Bytes(passphrase);
    const { key, iv } = evpBytesToKey(pass, salt, 32, 16);
    try {
        const plain = aesCbcDecrypt(key, iv, cipher);
        return bytesToUtf8(plain);
    } catch {
        return null;
    }
}

// --- Extractor --------------------------------------------------------------
export function isBepeakUrl(url) {
    return /\/embed\/[0-9a-f]{16,}/i.test(String(url || ''));
}

function originOf(url) {
    const m = String(url || '').match(/^(https?:\/\/[^/]+)/i);
    return m ? m[1] : '';
}

async function fetchEmbedSettings(embedUrl, referer) {
    const origin = originOf(embedUrl);
    const response = await fetch(embedUrl, {
        headers: { ...SITE_HEADERS, Referer: referer || `${origin}/` },
        signal: timeoutSignal()
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} on ${embedUrl}`);
    const html = await response.text();

    // bePlayer('<passphrase>', '<{ct,iv,s} json>')
    const match = /bePlayer\(\s*'([^']+)'\s*,\s*'([\s\S]*?)'\s*\)/.exec(html);
    if (!match) return null;

    const decrypted = decryptBePlayer(match[1], match[2]);
    if (!decrypted) return null;

    let settings;
    try { settings = JSON.parse(decrypted); } catch { return null; }
    return { settings, origin };
}

function mapSubtitles(strSubtitles, origin) {
    return (strSubtitles || []).map(sub => {
        if (!sub || !sub.file) return null;
        let url = String(sub.file).replace(/\\\//g, '/');
        if (/^\//.test(url)) url = `${origin}${url}`;
        if (!/^https?:\/\//.test(url)) return null;
        const label = String(sub.label || sub.language || 'Altyazı').trim();
        const raw = String(sub.language || sub.label || '').toLowerCase();
        const lang = /tr|tur|türk|turk/.test(raw) ? 'tr' : (/en|eng|ing/.test(raw) ? 'en' : (raw.slice(0, 2) || 'und'));
        return { url, lang, label, language: label, name: label, format: /\.srt(\?|$)/i.test(url) ? 'srt' : 'vtt' };
    }).filter(Boolean);
}

// vidlop extractStreams ile aynı çıktı sözleşmesi: [{ url, host, type, headers, subtitles }]
export async function extractBepeak(embedUrl, referer) {
    const result = await fetchEmbedSettings(embedUrl, referer);
    if (!result) return [];

    const { settings, origin } = result;
    let streamUrl = String(settings.video_location || '').replace(/\\\//g, '/');
    if (!streamUrl || !/^https?:\/\//.test(streamUrl)) return [];

    // Master'ı bir kez çek: kalite etiketi (RESOLUTION) + masaüstü modu için
    // memory:// içine konacak ham metin. vidmixi genelde 480p + 1080p sunar.
    let quality = null;
    let master = null;
    try {
        const resp = await fetch(streamUrl, {
            headers: { ...SITE_HEADERS, Referer: `${origin}/` },
            signal: timeoutSignal()
        });
        if (resp.ok) {
            master = await resp.text();
            quality = detectHlsQuality(master);
        }
    } catch {
        quality = null;
    }

    return [{
        url: streamUrl,
        host: 'Bepeak',
        type: 'm3u8',
        quality,
        master,
        headers: { Referer: `${origin}/`, Origin: origin },
        subtitles: mapSubtitles(settings.strSubtitles, origin)
    }];
}

export async function extractBepeakSubtitles(embedUrl, referer) {
    const result = await fetchEmbedSettings(embedUrl, referer);
    if (!result) return [];
    return mapSubtitles(result.settings.strSubtitles, result.origin);
}
