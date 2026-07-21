/**
 * Provider domain sağlık kontrolü (+ opsiyonel otomatik düzeltme).
 *
 * src/<id>/constants.js içindeki DOMAIN_CANDIDATES listelerini (ve dizibal
 * gibi tek sabit BASE_URL kullanan provider'ları) tarayıp her domain'e
 * istek atar. Site domain'leri sık değiştiği için (bkz. CLAUDE.md) bu
 * script'in amacı bozulmayı elle keşfetmeden önce yakalamak.
 *
 * Kullanım:
 *   node scripts/check-domains.js          # sadece raporla
 *   node scripts/check-domains.js --fix    # ayrıca DOMAIN_CANDIDATES sırasını
 *                                          # canlı/güncel domain'i başa alacak
 *                                          # şekilde constants.js'e yaz
 *
 * --fix SADECE domain rotasyonunu (301/302 ile yeni bir domain'e taşınma)
 * otomatik düzeltir — bu mekanik bir işlem (yeni domain'i listenin başına
 * al). Sitenin HTML/API yapısı değiştiyse (selector kırılması vb.) bu
 * script bunu tespit edemez/düzeltemez; o durumda test harness'ları
 * (npm test, test:fullhdfilm, test:dizifilm) başarısız olur ve insan/LLM
 * müdahalesi gerekir.
 *
 * Çıkış kodu: bir provider'ın TÜM domain adayları ölüyse (bağlantı hatası
 * veya 4xx/5xx) 1, aksi halde 0.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const TIMEOUT_MS = 10000;
const FIX = process.argv.includes('--fix');

function normalize(url) {
    return url.replace(/\/$/, '');
}

function extractDomainCandidates(source) {
    const match = source.match(/DOMAIN_CANDIDATES\s*=\s*\[([\s\S]*?)\]/);
    if (!match) return null;
    const domains = [...match[1].matchAll(/['"`](https?:\/\/[^'"`]+)['"`]/g)].map(m => m[1]);
    return { domains, raw: match[0], inner: match[1] };
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
        let fixable = null; // { constantsPath }
        const constantsPath = path.join(dir, 'constants.js');
        if (fs.existsSync(constantsPath)) {
            const source = fs.readFileSync(constantsPath, 'utf8');
            const extracted = extractDomainCandidates(source);
            if (extracted) {
                domains = extracted.domains;
                fixable = { constantsPath };
            } else {
                domains = extractBaseUrl(source);
            }
        }
        if (!domains.length) {
            const indexPath = path.join(dir, 'index.js');
            if (fs.existsSync(indexPath)) {
                domains = extractBaseUrl(fs.readFileSync(indexPath, 'utf8'));
            }
        }
        if (domains.length) providers.push({ id, domains, fixable });
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
        const finalUrl = response.url ? normalize(response.url) : normalize(url);
        const redirected = finalUrl !== normalize(url);
        return { ok: response.ok, status: response.status, redirected, finalUrl };
    } catch (err) {
        return { ok: false, status: null, error: err.message };
    } finally {
        clearTimeout(timer);
    }
}

function rewriteDomainCandidates(constantsPath, newOrder) {
    const source = fs.readFileSync(constantsPath, 'utf8');
    const extracted = extractDomainCandidates(source);
    if (!extracted) return false;

    const indent = '    ';
    const body = newOrder.map(url => `${indent}'${url}'`).join(',\n');
    const replacement = `DOMAIN_CANDIDATES = [\n${body}\n]`;
    const updated = source.replace(extracted.raw, replacement);
    fs.writeFileSync(constantsPath, updated);
    return true;
}

async function main() {
    const providers = discoverProviders();
    let hasDeadProvider = false;
    const fixedFiles = [];

    for (const { id, domains, fixable } of providers) {
        console.log(`\n=== ${id} ===`);
        let anyOk = false;
        const healthyInOrder = [];

        for (const domain of domains) {
            const result = await checkDomain(domain);
            if (result.ok) {
                anyOk = true;
                healthyInOrder.push(result.finalUrl);
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

        if (FIX && fixable && anyOk) {
            const dedupedHealthy = [...new Set(healthyInOrder)];
            const rest = domains.map(normalize).filter(d => !dedupedHealthy.includes(d));
            const newOrder = [...dedupedHealthy, ...rest];
            const currentOrder = domains.map(normalize);
            if (JSON.stringify(newOrder) !== JSON.stringify(currentOrder)) {
                rewriteDomainCandidates(fixable.constantsPath, newOrder);
                fixedFiles.push(fixable.constantsPath);
                console.log(`  🔧 ${id}: DOMAIN_CANDIDATES güncellendi -> [${newOrder.join(', ')}]`);
            }
        }
    }

    console.log('');
    if (FIX) {
        console.log(fixedFiles.length ? `${fixedFiles.length} dosya güncellendi: ${fixedFiles.join(', ')}` : 'Düzeltilecek bir şey yok, tüm listeler zaten güncel sırada.');
    }

    if (hasDeadProvider) {
        console.error('En az bir provider için TÜM domain adayları ölü. constants.js güncellenmeli (--fix bunu otomatik çözemez, yeni domain bulunup elle eklenmeli).');
        process.exit(1);
    }
    console.log("Tüm provider'lar için en az bir domain adayı çalışıyor.");
}

main().catch(err => {
    console.error('check-domains.js hata verdi:', err);
    process.exit(1);
});
