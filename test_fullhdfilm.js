/**
 * FullHDFilmizlesene provider test scripti (.mx)
 *
 * Usage:
 *   npm run build && node test_fullhdfilm.js
 *   node test_fullhdfilm.js <tmdbId> movie
 *
 * Varsayılan: Hayvan Yarışı / Corrida dos Bichos (sitede güncel örnek).
 * Not: .mx Cloudflare arkasında olabilir; bu ortamda 0 stream CF engeli demektir.
 * Nuvio cihaz/ağında farklı davranabilir.
 */

const { getStreams } = require('./providers/fullhdfilm.js');

// Varsayılan: Hayvan Yarışı / Corrida dos Bichos (TMDB 1263532) — .mx katalogunda mevcut.
const TMDB_ID = parseInt(process.argv[2] || '1263532', 10);
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
