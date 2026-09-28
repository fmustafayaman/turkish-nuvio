// Dizibal — Türkçe dublaj/altyazılı film, dizi ve anime kaynağı.
// Domain sık değişebilir; alternatifler sırayla denenir (bkz. src/dizibal/index.js).
// 2026-09: dizibal.com kapandı (sunucu bağlantıyı reddediyor); site dizibal.org'a
// taşındı ve altyapı değişti — JSON API (/api/series...) yerine HTML sayfa +
// /ara/oneri arama + Pilavyer player (s.php → __PLAYER__ config → HLS).
export const DOMAIN_CANDIDATES = [
    'https://dizibal.org'
];

export const SITE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
};
