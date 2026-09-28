/**
 * Bir fetch yanıtının Cloudflare challenge/engel sayfası olup olmadığını söyler.
 * scripts/cf-guard.js (CI test preload'u) ve scripts/check-domains.js kullanır.
 *
 * Engel sayılanlar (yalnızca server: cloudflare yanıtlarında):
 *   - `cf-mitigated: challenge` header'ı ("Just a moment..." managed challenge)
 *   - 403/429/503 + gövdede Cloudflare engel sayfası işaretleri (WAF/IP bloğu —
 *     GitHub runner IP'lerinde header'sız düz 403 olarak geliyor)
 */

const BLOCK_BODY_RE = /Just a moment\.\.\.|cf-chl-|Attention Required! \| Cloudflare|Sorry, you have been blocked|cf-error-details/i;

async function isCloudflareBlock(response) {
    if (!/cloudflare/i.test(response.headers.get('server') || '')) return false;
    if (response.headers.get('cf-mitigated') === 'challenge') return true;
    if (![403, 429, 503].includes(response.status)) return false;
    try {
        return BLOCK_BODY_RE.test(await response.clone().text());
    } catch {
        return false; // gövde okunamadı; engel olarak işaretleme
    }
}

module.exports = { isCloudflareBlock };
