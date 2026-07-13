# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proje

Turkish Nuvio ("turkish-nuvio") — [Nuvio](https://github.com/yoruix/nuvio) uygulaması için Türkçe film/dizi/anime stream provider koleksiyonu. Her provider TMDB id alır, doğrudan oynatılabilir stream (m3u8/mp4) döndürür. Provider'lar: animecix (anime, mp4), fullhdfilm (film, m3u8), dizifilm (film+dizi, m3u8), dizibal (film+dizi, m3u8).

## Komutlar

```bash
npm run build            # tüm provider'ları derle: src/<id>/ → providers/<id>.js
node build.js dizibal    # tek provider derle
npm run build:watch      # nodemon ile izleyerek derle
npm start                # yerel statik sunucu: http://localhost:3000/manifest.json
npm test                 # animecix uçtan uca test (test_animecix.js)
node test_fullhdfilm.js  # diğer provider test harness'ları (test_dizifilm.js de var)
```

Hızlı tek provider testi (build sonrası bundle üzerinden):

```bash
node -e "require('./providers/dizibal').getStreams('115678','tv',1,1).then(s=>console.log(s.length, s[0]?.title))"
```

Testlerde **TMDB numeric id** kullan (`604`, `76479` gibi), IMDb `tt...` değil.

## Mimari

**Çalışma modeli:** Nuvio, `manifest.json`'ı URL'den yükler (GitHub Raw üzerinden servis edilir), her scraper girdisindeki `filename` alanından JS bundle'ını çekip kendi gömülü JS motorunda (Hermes / React Native) çalıştırır. Bu yüzden `providers/` build çıktıları **commit edilir** — deploy mekanizması budur.

**Provider sözleşmesi:** Her provider tek fonksiyon export eder:

```js
async function getStreams(tmdbId, mediaType /* 'tv'|'movie' */, season, episode)
// → [{ name, title, url, quality, size, headers: {User-Agent, Referer, Origin}, provider, type: 'm3u8'|'mp4' }]
module.exports = { getStreams };
```

`headers` alanı, CDN'in istediği Referer/Origin'i taşır — oynatma için zorunludur. Bazı provider'lar (dizibal, dizifilm) ayrıca `getSubtitles` export eder.

**Build zinciri:** `src/` kaynak kodu hibrittir (shared'da ESM `import/export`, provider `index.js`'lerinde `module.exports`) ve **sadece esbuild ile derlenerek çalışır** — `src/` dosyaları Node'da doğrudan import edilemez. `build.js`, esbuild ile `src/<id>/index.js`'i tek CJS dosyasına (`format: cjs`, `platform: neutral`, `target: es2016`) bundle'lar. Test harness'ları bu yüzden `providers/*.js` bundle'larını `require` eder.

**Hermes kısıtları:** Kod Nuvio'nun Hermes runtime'ında çalışır — `URL` sınıfı yoktur, Node builtin'leri yoktur; yalnızca `fetch` tabanlı kod yaz. Harici npm paketi kullanma (mevcut kod sıfır runtime bağımlılıkla çalışır; `build.js`'deki `external` listesi kalıntıdır).

**Ortak yardımcılar (`src/shared/`):**
- `tmdb.js` — `getTmdbInfo(tmdbId, mediaType)`: TMDB'den başlık/orijinal başlık/Türkçe başlık/imdbId çözer. API anahtarı: `globalThis.TMDB_API_KEY` varsa o, yoksa gömülü topluluk anahtarı (Nuvio runtime anahtar enjekte etmez).
- `http.js` — `withTimeout`, `timeoutSignal`, varsayılan timeout'lar.
- `base64.js` — Hermes-uyumlu base64.

**Tipik provider akışı:** TMDB id → `getTmdbInfo` ile başlıklar → sitede başlıkla arama/eşleştirme → bölüm/film sayfası → embed/player çözümü → gerçek m3u8/mp4 URL + gerekli header'lar. Site sabitleri (domain adayları, header'lar) her provider'ın `constants.js`'inde tutulur.

**Yeni provider ekleme:** `src/<id>/index.js` (+ `constants.js` vb.) oluştur → `manifest.json`'a scraper girdisi ekle (`id`, `name`, `version`, `supportedTypes`, `filename: "providers/<id>.js"`, `contentLanguage`, `formats`) → `npm run build` → `providers/<id>.js` commit et.

**Önemli:** Nuvio yerel scraper'ları iframe/embed oynatmaz — provider `type: 'embed'` değil, çözülmüş doğrudan `m3u8`/`mp4` URL döndürmelidir.

## Notlar

- `.cursor/` klasöründe geçmiş geliştirme oturumlarının notları var (`CONTINUATION.md`, `dizipal-provider.md` vb.) — dizipal gibi üzerinde çalışılmış provider'ların teknik şemaları burada.
- `dist/` Cloudflare Pages deploy kopyasıdır (`_headers` CORS ayarları içerir); asıl dağıtım GitHub Raw üzerindendir.
- Site domain'leri sık değişir (özellikle dizipal); domain adayları `constants.js` dosyalarında liste olarak tutulur.
