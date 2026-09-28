/**
 * CI için Cloudflare engeli ayırıcı (preload: NODE_OPTIONS="--require ./scripts/cf-guard.js").
 *
 * Sorun: GitHub Actions runner'ları datacenter IP'si + Node TLS parmak izi
 * kullandığı için Cloudflare arkasındaki siteler (animecix, dizifilm,
 * fullhdfilm) CI'da 403 challenge/engel döndürüyor; aynı provider cihazda ve
 * yerelde çalışıyor. Bu yüzden health-check her gün "bozuk" diyordu ve gerçek
 * bozulmalar bu gürültüde kayboluyordu.
 *
 * Çözüm: fetch yanıtlarında Cloudflare engeli görülürse kaydet; süreç hata
 * koduyla biterse ve engel görülmüşse çıkış kodunu BLOCKED_EXIT_CODE (78) yap.
 * Workflow 78'i "CI'dan doğrulanamadı" (nötr) olarak raporlar, 1'i gerçek hata.
 *
 * Engel sayılanlar (yalnızca server: cloudflare yanıtlarında):
 *   - `cf-mitigated: challenge` header'ı ("Just a moment..." managed challenge)
 *   - 403/429/503 + gövdede Cloudflare engel sayfası işaretleri (WAF/IP bloğu)
 */

const BLOCKED_EXIT_CODE = 78;
const BLOCK_BODY_RE = /Just a moment\.\.\.|cf-chl-|Attention Required! \| Cloudflare|Sorry, you have been blocked|cf-error-details/i;

const blockedHosts = new Set();

function hostOf(url) {
    const match = String(url || '').match(/^https?:\/\/([^/?#]+)/i);
    return match ? match[1] : String(url);
}

async function inspect(response, requestUrl) {
    if (!/cloudflare/i.test(response.headers.get('server') || '')) return;
    const host = hostOf(response.url || requestUrl);
    if (response.headers.get('cf-mitigated') === 'challenge') {
        blockedHosts.add(host);
        return;
    }
    if (![403, 429, 503].includes(response.status)) return;
    try {
        const body = await response.clone().text();
        if (BLOCK_BODY_RE.test(body)) blockedHosts.add(host);
    } catch {
        // gövde okunamadı; engel olarak işaretleme
    }
}

const originalFetch = globalThis.fetch;
if (typeof originalFetch === 'function') {
    globalThis.fetch = async function guardedFetch(input, init) {
        const response = await originalFetch(input, init);
        const requestUrl = typeof input === 'string' ? input : input && input.url;
        await inspect(response, requestUrl);
        return response;
    };
}

// check-stream-schema.js gibi çok provider'lı script'ler, provider bazında
// "bu provider'ın hatası CF engelinden mi" diye sorabilsin.
globalThis.__cfGuard = {
    BLOCKED_EXIT_CODE,
    snapshot: () => blockedHosts.size,
    hostsSince: (snapshot) => [...blockedHosts].slice(snapshot)
};

process.on('exit', (code) => {
    if (code === 0 || code === BLOCKED_EXIT_CODE || !blockedHosts.size) return;
    console.error(`\n🛡️  Cloudflare engeli: ${[...blockedHosts].join(', ')} — CI IP'si challenge'landı/engellendi.`);
    console.error('    Bu sonuç provider bozukluğu anlamına gelmiyor; cihazda/yerelde doğrulanmalı.');
    process.exitCode = BLOCKED_EXIT_CODE;
});
