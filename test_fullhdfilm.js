/**
 * FullHDFilmizlesene provider test scripti
 *
 * Usage:
 *   npm run build && node test_fullhdfilm.js 24428 movie   (Yenilmezler / Avengers)
 *   node test_fullhdfilm.js 30634 movie  (Organize İşler)
 */

const { getStreams } = require('./providers/fullhdfilm.js');

// Varsayılan: Yenilmezler — sitede TRPlayer kaynağı olan bilinen çalışan örnek.
// Not: Bazı filmler yalnızca ölü embed host (boosterx/pxplayer) taşıyor; o durumda 0 stream normal.
const TMDB_ID = parseInt(process.argv[2] || '24428', 10);
const MEDIA_TYPE = process.argv[3] || 'movie';

async function main() {
    console.log(`Testing FullHDFilmizlesene: tmdb=${TMDB_ID} type=${MEDIA_TYPE}\n`);

    const streams = await getStreams(TMDB_ID, MEDIA_TYPE);

    if (!streams.length) {
        console.log('No streams found.');
        process.exit(1);
    }

    console.log(`Found ${streams.length} stream(s):\n`);
    for (const stream of streams) {
        console.log(`  [${stream.name}] ${stream.type}`);
        console.log(`  ${stream.url}`);
        console.log('');
    }
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
