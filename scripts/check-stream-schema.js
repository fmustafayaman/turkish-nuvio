/**
 * Provider sözleşmesi (CLAUDE.md) doğrulaması.
 *
 * Mevcut test_*.js harness'ları yalnızca "en az 1 stream döndü mü" kontrol
 * ediyor; bu script döndürülen her stream objesinin gerçek şeklini
 * (url/quality/type/headers/provider alanları) doğrular. Amaç: bir
 * provider "çalışıyor" görünüp Nuvio'nun beklediği şekle uymayan bozuk bir
 * obje döndürdüğünde (ör. url eksik, type geçersiz) bunu build sonrası
 * yakalamak.
 *
 * Kullanım:
 *   npm run build && node scripts/check-stream-schema.js
 */

const PROVIDERS = [
    { id: 'animecix', args: ['37854', 'tv', 1, 1] },
    { id: 'fullhdfilm', args: ['157336', 'movie'] },
    { id: 'dizifilm', args: ['1396', 'tv', 1, 1] },
    { id: 'dizibal', args: ['1396', 'tv', 1, 1] },
];

const VALID_TYPES = new Set(['m3u8', 'mp4']);

function validateStream(stream, id) {
    const errors = [];
    if (typeof stream !== 'object' || stream === null) {
        return [`stream bir obje değil (${typeof stream})`];
    }
    if (typeof stream.url !== 'string' || !/^https?:\/\//i.test(stream.url)) {
        errors.push(`url geçersiz: ${JSON.stringify(stream.url)}`);
    }
    if (!VALID_TYPES.has(stream.type)) {
        errors.push(`type geçersiz (m3u8|mp4 olmalı): ${JSON.stringify(stream.type)}`);
    }
    if (typeof stream.quality !== 'string' || !stream.quality) {
        errors.push(`quality eksik/geçersiz: ${JSON.stringify(stream.quality)}`);
    }
    if (typeof stream.headers !== 'object' || stream.headers === null || Array.isArray(stream.headers)) {
        errors.push(`headers bir obje olmalı: ${JSON.stringify(stream.headers)}`);
    }
    if (stream.provider !== id) {
        errors.push(`provider "${id}" bekleniyordu, "${stream.provider}" geldi`);
    }
    return errors;
}

// CI'da scripts/cf-guard.js preload edilmişse, 0 stream'in sebebi o provider'ın
// sitesinin Cloudflare engeli mi diye bakılır; öyleyse hata değil "atlandı" sayılır.
const cfGuard = globalThis.__cfGuard || null;

async function main() {
    let hasFailure = false;
    const blocked = [];

    for (const { id, args } of PROVIDERS) {
        console.log(`\n=== ${id} ===`);
        let mod;
        try {
            mod = require(`../providers/${id}.js`);
        } catch (e) {
            console.log(`  ❌ providers/${id}.js require edilemedi: ${e.message}`);
            hasFailure = true;
            continue;
        }

        if (typeof mod.getStreams !== 'function') {
            console.log('  ❌ getStreams export edilmemiş');
            hasFailure = true;
            continue;
        }

        const cfSnapshot = cfGuard ? cfGuard.snapshot() : 0;
        let streams;
        try {
            streams = await mod.getStreams(...args);
        } catch (e) {
            console.log(`  ❌ getStreams hata fırlattı: ${e.message}`);
            hasFailure = true;
            continue;
        }

        if (!Array.isArray(streams)) {
            console.log(`  ❌ getStreams array döndürmedi (${typeof streams})`);
            hasFailure = true;
            continue;
        }
        const cfHosts = cfGuard ? cfGuard.hostsSince(cfSnapshot) : [];
        if (!streams.length && cfHosts.length) {
            console.log(`  🛡️  0 stream — Cloudflare engeli (${cfHosts.join(', ')}); CI'dan doğrulanamadı, atlandı`);
            blocked.push(id);
            continue;
        }
        if (!streams.length) {
            console.log('  ❌ 0 stream döndü (test tmdb id\'si geçici olarak kaynakta olmayabilir)');
            hasFailure = true;
            continue;
        }

        let providerOk = true;
        streams.forEach((stream, i) => {
            const errors = validateStream(stream, id);
            if (errors.length) {
                providerOk = false;
                console.log(`  ❌ stream[${i}]: ${errors.join('; ')}`);
            }
        });

        if (providerOk) {
            console.log(`  ✅ ${streams.length} stream, hepsi sözleşmeye uyuyor`);
        } else {
            hasFailure = true;
        }
    }

    console.log('');
    if (hasFailure) {
        console.error('Şema doğrulaması başarısız.');
        process.exit(1);
    }
    if (blocked.length) {
        console.log(`Doğrulanan provider'lar sözleşmeye uygun; Cloudflare nedeniyle atlanan: ${blocked.join(', ')}.`);
        process.exit(cfGuard.BLOCKED_EXIT_CODE);
    }
    console.log("Tüm provider'lar sözleşmeye uygun stream döndürüyor.");
}

main().catch(err => {
    console.error('check-stream-schema.js hata verdi:', err);
    process.exit(1);
});
