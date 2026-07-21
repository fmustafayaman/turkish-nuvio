/**
 * Provider domain sağlık kontrolü.
 *
 * src/<id>/constants.js içindeki DOMAIN_CANDIDATES listelerini (ve dizibal
 * gibi tek sabit BASE_URL kullanan provider'ları) tarayıp her domain'e
 * istek atar. Site domain'leri sık değiştiği için (bkz. CLAUDE.md) bu
 * script'in amacı bozulmayı elle keşfetmeden önce yakalamak.
 *
 * Kullanım:
 *   node scripts/check-domains.js
 *
 * Çıkış kodu: bir provider'ın TÜM domain adayları ölüyse (bağlantı hatası
 * veya 4xx/5xx) 1, aksi halde 0. Yalnızca redirect olması (301/302 ile
 * başka bir domain'e düşmesi) hata sayılmaz, sadece UYARI olarak basılır
 * — çünkü fetch() redirect'i otomatik takip eder ve provider yine çalışır;
 * ama ilk sıradaki aday artık güncel değil demektir, constants.js'te
 * sırayı güncellemek gerekebilir.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const TIMEOUT_MS = 10000;

function extractDomainCandidates(source) {
    const match = source.match(/DOMAIN_CANDIDATES\s*=\s*\[([\s\S]*?)\]/);
    if (!match) return [];
    return [...match[1].matchAll(/['"`](https?:\/\/[^'"`]+)['"`]/g)].map(m => m[1]);
}

function extractBaseUrl(source) {
    const match = source.match(/BASE_URL\s*=\s*['"`](https?:\/\/[^'"`]+)['"`]/);
    return match ? [match[1]] : [];
}

function discoverProviders() {
    const providers = [];
    for (const id of fs.readdirSync(SRC_DIR)) {
        if (id === 'shared') continue;
        const dir = path.join(SRC_DIR, id);
        if (!fs.statSync(dir).isDirectory()) continue;

        let domains = [];
        const constantsPath = path.join(dir, 'constants.js');
        if (fs.existsSync(constantsPath)) {
            const source = fs.readFileSync(constantsPath, 'utf8');
            domains = extractDomainCandidates(source);
            if (!domains.length) domains = extractBaseUrl(source);
        }
        if (!domains.length) {
            const indexPath = path.join(dir, 'index.js');
            if (fs.existsSync(indexPath)) {
                domains = extractBaseUrl(fs.readFileSync(indexPath, 'utf8'));
            }
        }
        if (domains.length) providers.push({ id, domains });
    }
    return providers;
}

async function checkDomain(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' }
        });
        const finalUrl = response.url;
        const redirected = finalUrl && !finalUrl.startsWith(url.replace(/\/$/, '')) && finalUrl.replace(/\/$/, '') !== url.replace(/\/$/, '');
        return { ok: response.ok, status: response.status, redirected, finalUrl };
    } catch (err) {
        return { ok: false, status: null, error: err.message };
    } finally {
        clearTimeout(timer);
    }
}

async function main() {
    const providers = discoverProviders();
    let hasDeadProvider = false;

    for (const { id, domains } of providers) {
        console.log(`\n=== ${id} ===`);
        let anyOk = false;

        for (const domain of domains) {
            const result = await checkDomain(domain);
            if (result.ok) {
                anyOk = true;
                if (result.redirected) {
                    console.log(`  ⚠️  ${domain} -> 301/302 -> ${result.finalUrl} (UYARI: constants.js'te bu domain artık birincil değil olabilir)`);
                } else {
                    console.log(`  ✅ ${domain} (${result.status})`);
                }
            } else {
                console.log(`  ❌ ${domain} — ${result.error || `HTTP ${result.status}`}`);
            }
        }

        if (!anyOk) {
            hasDeadProvider = true;
            console.log(`  🔴 ${id}: hiçbir domain adayı çalışmıyor!`);
        }
    }

    console.log('');
    if (hasDeadProvider) {
        console.error('En az bir provider için TÜM domain adayları ölü. constants.js güncellenmeli.');
        process.exit(1);
    }
    console.log("Tüm provider'lar için en az bir domain adayı çalışıyor.");
}

main().catch(err => {
    console.error('check-domains.js hata verdi:', err);
    process.exit(1);
});
