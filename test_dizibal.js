/**
 * Dizibal provider test scripti (dizibal.org)
 *
 * Usage:
 *   npm run build && node test_dizibal.js            (Game of Thrones S1E1)
 *   node test_dizibal.js 1396 tv 1 1                 (Breaking Bad S1E1)
 *   node test_dizibal.js 557 movie                   (Örümcek Adam, 2002)
 *
 * Stream sayısına ek olarak dönen URL'nin gerçekten HLS master verdiğini
 * (stream'in header'larıyla) doğrular.
 */

const { getStreams, getSubtitles } = require('./providers/dizibal.js');

const TMDB_ID = parseInt(process.argv[2] || '1399', 10);
const MEDIA_TYPE = process.argv[3] || 'tv';
const SEASON = parseInt(process.argv[4] || '1', 10);
const EPISODE = parseInt(process.argv[5] || '1', 10);

async function main() {
    console.log(`Testing Dizibal: tmdb=${TMDB_ID} type=${MEDIA_TYPE} s=${SEASON} e=${EPISODE}\n`);

    const streams = await getStreams(TMDB_ID, MEDIA_TYPE, SEASON, EPISODE);

    if (!streams.length) {
        console.log('No streams found.');
        process.exit(1);
    }

    console.log(`Found ${streams.length} stream(s):\n`);
    for (const stream of streams) {
        console.log(`  [${stream.name}] ${stream.type} — ${stream.title.replace(/\n/g, ' | ')}`);
        console.log(`  ${stream.url}`);
        if (stream.subtitles && stream.subtitles.length) {
            console.log(`  subtitles: ${stream.subtitles.map(s => s.label || s.name).join(', ')}`);
        }

        const response = await fetch(stream.url, { headers: stream.headers });
        const text = await response.text();
        if (!response.ok || !/#EXTM3U/.test(text)) {
            console.log(`  ❌ stream açılmadı: HTTP ${response.status}`);
            process.exit(1);
        }
        console.log(`  ✅ HLS master erişilebilir (HTTP ${response.status})`);
        console.log('');
    }

    console.log('--- getSubtitles() ---');
    const subs = await getSubtitles(TMDB_ID, MEDIA_TYPE, SEASON, EPISODE);
    if (!subs.length) {
        console.log('No subtitles found.');
    } else {
        for (const sub of subs) {
            console.log(`  [${sub.label}] lang=${sub.lang} format=${sub.format}`);
        }
    }
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
