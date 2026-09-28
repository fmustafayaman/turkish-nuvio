/**
 * Node'un fetch'ini macOS native URLSession'a yönlendiren test köprüsü.
 *
 * Neden: Bazı siteler (ör. fullhdfilmizlesene.now) Cloudflare ile Node/curl'ün
 * TLS/HTTP2 parmak izine "Just a moment..." challenge'ı döndürürken, cihazdaki
 * Nuvio'nun native ağ yığınına (iOS'takiyle aynı URLSession; macOS'ta doğrulandı) sayfayı
 * normal veriyor. Node'la yapılan yerel test bu yüzden cihazdan farklı sonuç
 * verir. Bu köprü ile yerel test, cihazdaki davranışa denk olur.
 *
 * Kullanım (yalnızca macOS, Xcode Command Line Tools gerekir):
 *   NATIVE_FETCH=1 node test_fullhdfilm.js
 *   node -r ./scripts/native-fetch/shim.js -e "require('./providers/fullhdfilm')..."
 *
 * NATIVE_FETCH ayarlı değilse veya macOS değilse hiçbir şey yapmaz.
 */

const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, 'nfetch.swift');
const BINARY = path.join(__dirname, '..', '..', 'node_modules', '.cache', 'nfetch', 'nfetch');

function ensureBinary() {
    const stale = !fs.existsSync(BINARY) || fs.statSync(BINARY).mtimeMs < fs.statSync(SOURCE).mtimeMs;
    if (!stale) return;
    fs.mkdirSync(path.dirname(BINARY), { recursive: true });
    execFileSync('swiftc', ['-O', SOURCE, '-o', BINARY], { stdio: 'inherit' });
}

function toHeaderObject(headers) {
    if (!headers) return {};
    if (typeof headers.forEach === 'function' && !Array.isArray(headers)) {
        const out = {};
        headers.forEach((value, key) => { out[key] = value; });
        return out;
    }
    if (Array.isArray(headers)) return Object.fromEntries(headers);
    return { ...headers };
}

function makeResponse(raw, requestUrl) {
    const body = Buffer.from(raw.body || '', 'base64');
    const headers = new Headers(raw.headers || {});
    return {
        ok: raw.status >= 200 && raw.status < 300,
        status: raw.status,
        statusText: '',
        url: raw.url || requestUrl,
        redirected: Boolean(raw.url && raw.url !== requestUrl),
        headers,
        text: async () => body.toString('utf8'),
        json: async () => JSON.parse(body.toString('utf8')),
        arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        clone() { return makeResponse(raw, requestUrl); }
    };
}

function nativeFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const payload = {
        url,
        method: init.method || 'GET',
        headers: toHeaderObject(init.headers)
    };
    if (init.body != null) payload.body = Buffer.from(String(init.body)).toString('base64');

    return new Promise((resolve, reject) => {
        const child = execFile(BINARY, [JSON.stringify(payload)], { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
            if (err) return reject(new TypeError(`native fetch failed: ${err.message}`));
            let raw;
            try { raw = JSON.parse(stdout); } catch (e) { return reject(new TypeError(`native fetch bad output: ${e.message}`)); }
            if (raw.status == null) return reject(new TypeError(raw.error || 'native fetch: no response'));
            resolve(makeResponse(raw, url));
        });
        if (init.signal) {
            const abort = () => { child.kill(); reject(new DOMException('The operation was aborted.', 'AbortError')); };
            if (init.signal.aborted) abort();
            else init.signal.addEventListener('abort', abort, { once: true });
        }
    });
}

if (process.env.NATIVE_FETCH && process.platform === 'darwin') {
    ensureBinary();
    globalThis.fetch = nativeFetch;
    console.error('[native-fetch] fetch → macOS URLSession');
}

module.exports = { nativeFetch };
