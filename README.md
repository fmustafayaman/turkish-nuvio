# Turkish Nuvio

[Nuvio](https://github.com/yoruix/nuvio) için Türkçe film, dizi ve anime kaynakları. Her provider TMDB id alır, doğrudan oynatılabilir stream (m3u8/mp4) döndürür — Nuvio yerel scraper'ları iframe/embed oynatmaz.

**Lisans:** [GPL-3.0](LICENSE)

## Nuvio'ya ekle

Nuvio → **Eklentiler** → **Plugin manifest URL** alanına yapıştır:

```
https://raw.githubusercontent.com/fmustafayaman/turkish-nuvio/main/manifest.json
```

## Kaynaklar

| Provider | Site | İçerik | Format | Ayarlar |
|----------|------|--------|--------|---------|
| **Animecix** | animecix.tv | Anime (film + dizi) | mp4 | TMDB API anahtarı |
| **FullHDFilmizlesene** | fullhdfilmizlesene.life | Film | m3u8 | Masaüstü altyazı, TMDB API anahtarı |
| **Dizifilm** | dizifilm.life | Film + dizi | m3u8 | Masaüstü altyazı, TMDB API anahtarı |
| **Dizibal** | dizibal.com | Film + dizi | m3u8 | Masaüstü altyazı, TMDB API anahtarı |

Tüm provider'lar başlık/imdb bilgisi için TMDB kullanır; varsayılan olarak paylaşılan bir topluluk API anahtarı gömülüdür. İstersen her provider'ın Nuvio içindeki ayarlar ekranından ("TMDB API Anahtarı") kendi ücretsiz [TMDB API anahtarını](https://www.themoviedb.org/settings/api) girebilirsin — girilirse TMDB istekleri onunla yapılır, boş bırakılırsa varsayılan anahtar kullanılmaya devam eder.

"Masaüstü altyazı" ayarı ise Nuvio Desktop (MPV) için: bazı kaynaklar masaüstünde düzgün oynamaz veya altyazı yüklemez, bu ayar açıldığında stream masaüstü oynatıcıya göre uyarlanır. Sadece masaüstünde açık tutulması önerilir; TV/Android'de kapalı bırakılmalı.

## Geliştirme

```bash
npm install
npm run build           # tüm provider'ları derle: src/<id>/ → providers/<id>.js
node build.js dizibal    # tek provider derle
npm run build:watch     # nodemon ile izleyerek derle
npm start                # yerel statik sunucu: http://localhost:3000/manifest.json
```

Testler:

```bash
npm test                    # animecix uçtan uca test (test_animecix.js)
npm run test:fullhdfilm     # fullhdfilm test harness'ı
npm run test:dizifilm       # dizifilm test harness'ı
npm run check:domains       # her provider'ın domain adaylarının canlı olup olmadığını kontrol eder
```

Site domain'leri sık değiştiği için (özellikle fullhdfilm/dizifilm) `.github/workflows/health-check.yml` her gün build + testleri + `check:domains`'i çalıştırır; bir şey bozulursa repo'da otomatik bir issue açar/günceller, düzelince kapatır.

Hızlı tek provider testi (build sonrası bundle üzerinden):

```bash
node -e "require('./providers/dizibal').getStreams('115678','tv',1,1).then(s=>console.log(s.length, s[0]?.title))"
```

Testlerde **TMDB numeric id** kullanın (`604`, `76479` gibi), IMDb `tt...` değil.

## Mimari

Nuvio, `manifest.json`'ı GitHub Raw üzerinden yükler, her scraper girdisindeki `filename` alanından JS bundle'ını çekip kendi gömülü JS motorunda (Hermes / React Native) çalıştırır. Bu yüzden `providers/` build çıktıları **commit edilir** — deploy mekanizması budur.

Her provider tek fonksiyon export eder:

```js
async function getStreams(tmdbId, mediaType /* 'tv'|'movie' */, season, episode)
// → [{ name, title, url, quality, size, headers: {User-Agent, Referer, Origin}, provider, type: 'm3u8'|'mp4' }]
module.exports = { getStreams };
```

Bazı provider'lar ayrıca `getSubtitles` ve `onSettings` (Nuvio ayarlar ekranı için) export eder. Ayar değerleri `globalThis.SCRAPER_SETTINGS` üzerinden provider'a geri döner (bkz. `src/shared/hls.js`, `src/shared/tmdb.js`).

`src/` kaynak kodu yalnızca esbuild ile derlenerek çalışır ve Nuvio'nun Hermes runtime'ında koşar: `URL` sınıfı ve Node builtin'leri yoktur, yalnızca `fetch` tabanlı kod kullanılır, harici npm paketi yoktur.

```
src/           # kaynak kod (provider başına klasör + shared/)
providers/     # build çıktıları (Nuvio bunları yükler)
manifest.json  # eklenti kaydı
build.js       # esbuild bundler
server.js      # yerel geliştirme sunucusu
```

## Katkı

Pull request'ler memnuniyetle karşılanır. Yeni provider eklerken `src/<id>/` (+ `constants.js` vb.) oluşturup `manifest.json`'a scraper girdisi ekleyin, `npm run build` çalıştırıp `providers/<id>.js`'i commit edin.

## Sorumluluk reddi

Bu proje yalnızca eğitim ve kişisel kullanım amaçlıdır. İçerik kaynaklarına ait telif hakları ilgili sahiplerindedir. Kullanıcı, yerel yasalara uygunluktan kendisi sorumludur.
