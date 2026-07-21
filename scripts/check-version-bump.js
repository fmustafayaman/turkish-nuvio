/**
 * Commit'e giren provider değişikliklerinin manifest.json'da versiyon
 * bump'ı olmadan geçmesini engeller.
 *
 * Neden: Nuvio manifest.json'ı GitHub Raw'dan çeker ama kullanıcılar
 * genelde prebuilt/cache'lenmiş halini kullanıyor — bir scraper'ın kodu
 * değişse bile manifest'teki version aynıysa Nuvio güncellemeyi fark etmez.
 *
 * Kural:
 *   - src/<id>/... veya providers/<id>.js değiştiyse (staged) →
 *     manifest.json'daki scrapers[].version (o id için) da değişmiş olmalı.
 *   - src/shared/... değiştiyse (tüm provider'ları etkiler) →
 *     manifest.json'daki üst düzey "version" alanı değişmiş olmalı.
 *
 * git commit --no-verify ile atlanabilir (gerçekten gerekiyorsa).
 */

const { execSync } = require('child_process');

function sh(cmd) {
    return execSync(cmd, { encoding: 'utf8' });
}

function getManifestAt(ref) {
    try {
        return JSON.parse(sh(`git show ${ref}:manifest.json`));
    } catch {
        return null; // manifest.json bu ref'te yok (ör. ilk commit)
    }
}

function main() {
    const stagedFiles = sh('git diff --cached --name-only').split('\n').filter(Boolean);
    if (!stagedFiles.length) {
        return; // staged değişiklik yok (ör. amend boş commit)
    }

    const touchedProviderIds = new Set();
    let sharedTouched = false;
    let manifestTouched = false;

    for (const file of stagedFiles) {
        if (file === 'manifest.json') {
            manifestTouched = true;
            continue;
        }
        const srcMatch = file.match(/^src\/([^/]+)\//);
        if (srcMatch) {
            if (srcMatch[1] === 'shared') sharedTouched = true;
            else touchedProviderIds.add(srcMatch[1]);
            continue;
        }
        const providerMatch = file.match(/^providers\/([^/]+)\.js$/);
        if (providerMatch) touchedProviderIds.add(providerMatch[1]);
    }

    if (!touchedProviderIds.size && !sharedTouched) return;

    const problems = [];

    if (sharedTouched) {
        const oldManifest = getManifestAt('HEAD');
        const newManifest = manifestTouched ? JSON.parse(sh('git show :manifest.json')) : oldManifest;
        const oldVersion = oldManifest?.version;
        const newVersion = newManifest?.version;
        if (!manifestTouched || oldVersion === newVersion) {
            problems.push(`src/shared/ değişti ama manifest.json'ın üst düzey "version" alanı bump'lanmadı (${oldVersion} -> ${newVersion ?? oldVersion}).`);
        }
    }

    if (touchedProviderIds.size) {
        if (!manifestTouched) {
            problems.push(`Şu provider'lar değişti ama manifest.json hiç staged değil: ${[...touchedProviderIds].join(', ')}`);
        } else {
            const oldManifest = getManifestAt('HEAD');
            const newManifest = JSON.parse(sh('git show :manifest.json'));
            for (const id of touchedProviderIds) {
                const oldEntry = oldManifest?.scrapers?.find(s => s.id === id);
                const newEntry = newManifest?.scrapers?.find(s => s.id === id);
                if (!newEntry) continue; // manifest'te yok (yeni provider olabilir, build.js/manifest akışı ayrı ele alınır)
                if (oldEntry && oldEntry.version === newEntry.version) {
                    problems.push(`"${id}" değişti ama manifest.json'daki version aynı kaldı (${oldEntry.version}).`);
                }
            }
        }
    }

    if (problems.length) {
        console.error('\n🔴 Versiyon bump kontrolü başarısız:\n');
        for (const p of problems) console.error(`  - ${p}`);
        console.error('\nmanifest.json\'da ilgili version alan(lar)ını artırın (bkz. CLAUDE.md).');
        console.error('Gerçekten atlamak istiyorsanız: git commit --no-verify\n');
        process.exit(1);
    }
}

main();
