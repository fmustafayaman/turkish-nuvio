import { decodeBase64 } from '../shared/base64.js';
import { fetchText, postText } from './utils.js';

// Hermes'te global URL bulunmayabilir; origin'i regex ile çıkarıyoruz.
function originOf(url) {
    const m = /^(https?:\/\/[^/]+)/i.exec(String(url || ''));
    return m ? m[1] : '';
}

// Dean Edwards p.a.c.k.e.r çözücü (VidMoxy çift paketli kullanır).
const PACKER_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function baseN(num, radix) {
    if (num === 0) return '0';
    let out = '';
    while (num > 0) {
        out = PACKER_DIGITS[num % radix] + out;
        num = Math.floor(num / radix);
    }
    return out;
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unpack(packed) {
    const m = /\}\s*\(\s*'([\s\S]*)',\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\.split\('\|'\)/.exec(packed);
    if (!m) return null;

    let payload = m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const radix = parseInt(m[2], 10);
    let count = parseInt(m[3], 10);
    const dict = m[4].split('|');

    while (count-- > 0) {
        if (dict[count]) {
            payload = payload.replace(
                new RegExp('\\b' + escapeRegExp(baseN(count, radix)) + '\\b', 'g'),
                dict[count]
            );
        }
    }
    return payload;
}

// "\x68\x74..." veya "68 74..." biçimli hex dizisini metne çevirir.
function hexToString(value) {
    const cleaned = String(value).replace(/\\x/g, '').replace(/\\/g, '');
    let out = '';
    for (let i = 0; i + 1 < cleaned.length; i += 2) {
        const code = parseInt(cleaned.substr(i, 2), 16);
        if (Number.isNaN(code)) return '';
        out += String.fromCharCode(code);
    }
    return out;
}

// RapidVid jwSetup.sources içindeki av('...') değeri:
// reverse -> base64 -> her karakterden K9L anahtarına göre offset çıkar -> base64.
function rapidDecodeSecret(encoded) {
    const reversed = String(encoded).split('').reverse().join('');
    const t = decodeBase64(reversed);
    const key = 'K9L';
    let out = '';
    for (let i = 0; i < t.length; i++) {
        const offset = (key.charCodeAt(i % key.length) % 5) + 1;
        out += String.fromCharCode(t.charCodeAt(i) - offset);
    }
    return decodeBase64(out);
}

// jwSetup.tracks içindeki altyazı (captions) dosyalarını çıkarır.
function parseJwTracks(html) {
    const m = /jwSetup\.tracks\s*=\s*(\[[\s\S]*?\])\s*;/.exec(html);
    if (!m) return [];

    let tracks;
    try {
        tracks = JSON.parse(m[1]);
    } catch {
        return [];
    }

    const subs = [];
    for (const t of tracks || []) {
        if (!t || !t.file) continue;
        if (t.kind && t.kind !== 'captions' && t.kind !== 'subtitles') continue;
        const url = String(t.file).replace(/\\\//g, '/');
        if (!/^https?:\/\//.test(url)) continue;
        const label = String(t.label || 'Altyazı').trim();
        subs.push({ url, lang: label, language: label, name: label });
    }
    return subs;
}

function decodeUnicodeEscapes(value) {
    return String(value).replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );
}

// Paketli player'larda inline geçen captions girdilerini yakalar.
function parseInlineCaptions(html) {
    const subs = [];
    const re = /"kind":"captions","file":"([^"]+)","label":"([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const url = decodeUnicodeEscapes(m[1]).replace(/\\\//g, '/');
        if (!/^https?:\/\//.test(url)) continue;
        const label = decodeUnicodeEscapes(m[2]).trim();
        subs.push({ url, lang: label, language: label, name: label });
    }
    return subs;
}

function collectSubtitles(html) {
    const all = [...parseJwTracks(html), ...parseInlineCaptions(html)];
    const seen = new Set();
    return all.filter(s => {
        if (seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

async function extractRapidVid(embedUrl, referer) {
    const html = await fetchText(embedUrl, { headers: { Referer: referer } });
    const sources = html.split('jwSetup.sources')[1];
    if (!sources) return [];

    const match = /av\('([^']+)'\)/.exec(sources);
    if (!match) return [];

    const m3u8 = rapidDecodeSecret(match[1]);
    if (!m3u8 || !/^https?:\/\//.test(m3u8)) return [];

    return [{
        url: m3u8,
        host: 'RapidVid',
        type: 'm3u8',
        headers: { Referer: originOf(embedUrl) + '/' },
        subtitles: collectSubtitles(html)
    }];
}

async function extractTurkeyPlayer(embedUrl, referer) {
    const html = await fetchText(embedUrl, { headers: { Referer: referer } });
    const jsonMatch = /var\s+video\s*=\s*(\{[\s\S]*?\});/.exec(html);
    if (!jsonMatch) return [];

    const raw = jsonMatch[1];
    const uid = /"uid"\s*:\s*"?([^",}]+)"?/.exec(raw);
    const md5 = /"md5"\s*:\s*"([^"]+)"/.exec(raw);
    const id = /"id"\s*:\s*"?([^",}]+)"?/.exec(raw);
    if (!uid || !md5 || !id) return [];

    const origin = originOf(embedUrl);
    const master = `${origin}/m3u8/${uid[1]}/${md5[1]}/master.txt?s=1&id=${id[1]}&cache=1`;

    return [{
        url: master,
        host: 'TRPlayer',
        type: 'm3u8',
        headers: { Referer: origin + '/' }
    }];
}

async function extractVidMoxy(embedUrl, referer) {
    const html = await fetchText(embedUrl, { headers: { Referer: referer } });
    const origin = originOf(embedUrl);

    // 1) Doğrudan "file": "\x.." biçimi
    let fileMatch = /"file":\s*"([^"]*\\x[^"]*)"/.exec(html);
    let m3u8 = fileMatch ? hexToString(fileMatch[1]) : '';

    // 2) Paketli (eval) biçim — çift unpack sonrası file":"..." çıkar
    if (!m3u8) {
        const evalMatch = /\};\s*(eval\(function[\s\S]*?)var played = \d+;/.exec(html);
        if (evalMatch) {
            let unpacked = unpack(evalMatch[1]);
            const twice = unpacked ? unpack(unpacked) : null;
            const final = (twice || unpacked || '').replace(/\\\\/g, '\\');
            const fm = /file"\s*:\s*"([^"]*)"/.exec(final);
            if (fm) m3u8 = hexToString(fm[1]);
        }
    }

    if (!m3u8 || !/^https?:\/\//.test(m3u8)) return [];

    return [{
        url: m3u8,
        host: 'VidMoxy',
        type: 'm3u8',
        headers: { Referer: origin + '/' },
        subtitles: collectSubtitles(html)
    }];
}

// Sobreatsesuyp (PlayerJS): iframe -> playlist POST -> alt kaynak POST -> m3u8.
async function extractSobreatsesuyp(embedUrl, referer) {
    const origin = originOf(embedUrl);
    const html = await fetchText(embedUrl, { headers: { Referer: referer } });

    const m = /"file":"([^"]+)"/.exec(html);
    if (!m) return [];
    const file = m[1].replace(/\\\//g, '/');

    const listUrl = `${origin}/${file.replace(/^\/+/, '')}`;
    let list;
    try {
        list = JSON.parse(await postText(listUrl, `${origin}/`));
    } catch {
        return [];
    }
    if (!Array.isArray(list)) return [];

    const results = [];
    // İlk eleman ([]) atlanır; kalanlar { title, file }.
    for (let i = 1; i < list.length; i++) {
        const item = list[i];
        if (!item || !item.file) continue;

        const sub = String(item.file).slice(1);
        const playlistUrl = `${origin}/playlist/${sub}.txt`;

        let videoUrl;
        try {
            videoUrl = (await postText(playlistUrl, `${origin}/`)).trim();
        } catch {
            continue;
        }
        if (!/^https?:\/\//.test(videoUrl)) continue;

        const label = String(item.title || '').trim();
        results.push({
            url: videoUrl,
            host: label ? `Sobreatsesuyp ${label}` : 'Sobreatsesuyp',
            type: 'm3u8',
            headers: { Referer: `${origin}/` },
            subtitles: []
        });
    }
    return results;
}

// Ok.ru / odnoklassniki — videoPlayerMetadata API.
async function extractOkRu(embedUrl) {
    const idMatch = /(?:ok\.ru|odnoklassniki\.ru)\/(?:videoembed|video|live)\/(\d+)/i.exec(embedUrl)
        || /[?&]mid=(\d+)/i.exec(embedUrl);
    if (!idMatch) return [];

    const mid = idMatch[1];
    let raw;
    try {
        const response = await fetch('https://www.ok.ru/dk', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': `https://ok.ru/videoembed/${mid}`,
                'Origin': 'https://ok.ru',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: `cmd=videoPlayerMetadata&mid=${mid}`
        });
        if (!response.ok) return [];
        raw = await response.text();
    } catch {
        return [];
    }

    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return [];
    }
    if (!data || data.error) return [];

    const results = [];
    const push = (url, label) => {
        if (!url || !/^https?:\/\//.test(url)) return;
        results.push({
            url,
            host: label ? `OK.ru ${label}` : 'OK.ru',
            type: /\.m3u8/i.test(url) ? 'm3u8' : 'mp4',
            headers: { Referer: 'https://ok.ru/', 'User-Agent': 'Mozilla/5.0' },
            subtitles: []
        });
    };

    if (data.hlsManifestUrl) push(data.hlsManifestUrl, 'HLS');
    if (data.hlsMasterPlaylistUrl) push(data.hlsMasterPlaylistUrl, 'HLS');
    if (Array.isArray(data.videos)) {
        for (const v of data.videos) {
            if (v && v.url) push(v.url, v.name || v.type || '');
        }
    }
    return results;
}

// Generic: embed sayfasında doğrudan m3u8/mp4 URL yakala (boosterx, pxplayer vb.).
async function extractGenericStream(embedUrl, referer, hostName) {
    let html;
    try {
        html = await fetchText(embedUrl, { headers: { Referer: referer } });
    } catch {
        return [];
    }

    const found = new Set();
    const patterns = [
        /https?:\/\/[^"'\\\s<>]+?\.m3u8[^"'\\\s<>]*/gi,
        /https?:\/\/[^"'\\\s<>]+?\.mp4[^"'\\\s<>]*/gi,
        /["']file["']\s*[:=]\s*["'](https?:[^"']+)["']/gi,
        /["']src["']\s*[:=]\s*["'](https?:[^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
        /source\s+src=["'](https?:[^"']+)["']/gi
    ];

    for (const re of patterns) {
        let m;
        while ((m = re.exec(html)) !== null) {
            const url = (m[1] || m[0]).replace(/\\u0026/g, '&').replace(/\\\//g, '/');
            if (/^https?:\/\//.test(url) && !/google|facebook|analytics|parklogic/i.test(url)) {
                found.add(url);
            }
        }
    }

    const origin = originOf(embedUrl);
    return [...found].map(url => ({
        url,
        host: hostName || 'Embed',
        type: /\.m3u8/i.test(url) ? 'm3u8' : 'mp4',
        headers: { Referer: origin ? `${origin}/` : referer },
        subtitles: collectSubtitles(html)
    }));
}

// Sitede geçen ölü host adlarını bilinen canlı mirror'lara çevir.
// Örn. watch.trplayer.site (DNS yok) → watch.trplayer.com
const HOST_REWRITES = [
    [/^(https?:\/\/)(?:www\.)?watch\.trplayer\.site(\/|$)/i, '$1watch.trplayer.com$2'],
    [/^(https?:\/\/)(?:www\.)?trplayer\.site(\/|$)/i, '$1watch.trplayer.com$2'],
    [/^(https?:\/\/)(?:www\.)?trplayer\.org(\/|$)/i, '$1watch.trplayer.com$2']
];

function rewriteEmbedUrl(url) {
    let out = String(url || '').trim();
    for (const [re, rep] of HOST_REWRITES) {
        out = out.replace(re, rep);
    }
    return out;
}

// Verilen embed/host URL'sini uygun extractor'a yönlendirir.
export async function extractHost(embedUrl, referer) {
    try {
        if (!embedUrl || !/^https?:\/\//i.test(embedUrl)) return [];
        const url = rewriteEmbedUrl(embedUrl);

        if (/rapidvid|rapid/i.test(url)) {
            return await extractRapidVid(url, referer);
        }
        if (/trplayer|turkeyplayer|trstx/i.test(url)) {
            return await extractTurkeyPlayer(url, referer);
        }
        if (/vidmoxy/i.test(url)) {
            return await extractVidMoxy(url, referer);
        }
        if (/sobreatsesuyp|tovreatmemuyp|sobreat/i.test(url)) {
            return await extractSobreatsesuyp(url, referer);
        }
        if (/(?:ok\.ru|odnoklassniki)/i.test(url)) {
            const ok = await extractOkRu(url);
            if (ok.length) return ok;
        }
        if (/boosterx|pxplayer|fxplayer|vidmoly|filemoon|dood|streamtape|mixdrop/i.test(url)) {
            const host = (url.match(/^https?:\/\/([^/]+)/i) || [])[1] || 'Embed';
            const generic = await extractGenericStream(url, referer, host.split('.')[0]);
            if (generic.length) return generic;
        }

        // Son çare: bilinen host değilse generic dene
        return await extractGenericStream(url, referer, 'Embed');
    } catch {
        return [];
    }
}
