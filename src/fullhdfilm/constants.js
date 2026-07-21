// FullHDFilmizlesene — Türkçe dublaj/altyazılı film kaynağı.
// Domain sık değişebilir; alternatifler sırayla denenir.
export const DOMAIN_CANDIDATES = [
    'https://www.fullhdfilmizlesene.nz',
    'https://www.fullhdfilmizlesene.life',
    'https://www.fullhdfilmizlesene.de',
    'https://www.fullhdfilmizlesene.nl'
];

export const SITE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
};

// Stream çalınırken kaynak host'unun referer'ı kullanılır (extractor başına ayarlanır).
export const REQUEST_TIMEOUT_MS = 12000;
