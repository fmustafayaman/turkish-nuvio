/**
 * FullHDFilmizlesene provider test scripti (.now)
 *
 * Usage:
 *   npm run build && NATIVE_FETCH=1 node test_fullhdfilm.js
 *   NATIVE_FETCH=1 node test_fullhdfilm.js <tmdbId> movie
 *
 * Varsayılan: Yıldızlararası / Interstellar (TMDB 157336).
 *
 * Not: .now Cloudflare arkasında ve Node'un TLS parmak izine "Just a moment..."
 * challenge'ı döndürüyor; cihazdaki Nuvio (native ağ yığını) ise geçiyor. Bu
 * yüzden yerelde NATIVE_FETCH=1 ile çalıştır (macOS: fetch → URLSession, bkz.
 * scripts/native-fetch/). NATIVE_FETCH olmadan 0 stream = CF engeli, bozukluk değil.
 */

require('./scripts/native-fetch/shim.js');
const { getStreams } = require('./providers/fullhdfilm.js');

const TMDB_ID = parseInt(process.argv[2] || '157336', 10);
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
