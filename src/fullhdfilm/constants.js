// FullHDFilmizlesene — Türkçe dublaj/altyazılı film kaynağı.
// Domain sık değişebilir; alternatifler sırayla denenir.
// 2026-09: gerçek site www.fullhdfilmizlesene.now (.mx 301 ile buraya yönleniyor;
// yedek olarak tutuluyor). Yapı aynı: scx + /arama/ + /film/...
// fullhdfilmizlesene.co AYRI bir klon — katalog/player farklı; adaylara ekleme.
//
// Cloudflare: .now, Node/curl'ün TLS parmak izine "Just a moment..." challenge'ı
// döndürüyor ama Apple'ın native ağ yığınına (URLSession — iOS Nuvio'nun kullandığı)
// sayfayı normal veriyor; tam bir tarayıcı User-Agent'ı şartıyla (SITE_HEADERS;
// "Mozilla/5.0" gibi kısa UA engelleniyor). Android (OkHttp) doğrudan test
// edilmedi; OkHttp tabanlı güncel CloudStream eklentileri .now'a düz istek atıyor.
// Yerelde cihazla aynı sonucu almak için:
//   NATIVE_FETCH=1 node test_fullhdfilm.js   (bkz. scripts/native-fetch/)
export const DOMAIN_CANDIDATES = [
    'https://www.fullhdfilmizlesene.now',
    'https://www.fullhdfilmizlesene.mx'
];

export const SITE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
};

// Stream çalınırken kaynak host'unun referer'ı kullanılır (extractor başına ayarlanır).
export const REQUEST_TIMEOUT_MS = 12000;
