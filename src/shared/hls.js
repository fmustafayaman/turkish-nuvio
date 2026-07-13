// Desktop (Nuvio Kotlin/MPV) native player, sağlayıcının döndürdüğü
// externalSubtitles listesini MPV'ye iletmiyor (app bug; PR #168 merge edilmedi),
// bu yüzden altyazılar TV/Android'de çalışırken desktop'ta hiç görünmüyor.
//
// Workaround: video + harici altyazıları mpv'nin `edl://` protokolüyle TEK bir
// URL'de birleştirmek. mpv EDL, HLS videoyu ve WebVTT/SRT altyazıları ayrı
// "stream"ler olarak birleştirip player menüsünde seçilebilir track yapıyor —
// app düzeltmesine gerek kalmadan. (mpv ile ampirik olarak doğrulandı.)
//
// DİKKAT: edl:// yalnızca mpv'ye özgüdür; Android ExoPlayer anlamaz. O yüzden
// bu SADECE kullanıcı ayarı açıkken (desktop) uygulanmalı; kapalıyken normal
// url + externalSubtitles yolu korunur, TV/Android bozulmaz.

// Hermes-güvenli UTF-8 byte uzunluğu (mpv EDL %len% önekini byte ister).
function utf8ByteLength(str) {
    let bytes = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 0x80) bytes += 1;
        else if (c < 0x800) bytes += 2;
        else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++; } // surrogate pair
        else bytes += 3;
    }
    return bytes;
}

// mpv EDL, özel karakterli (&, =, ; ...) dizeleri %<byte-uzunluk>%<dize> ile alır.
function edlQuote(str) {
    const s = String(str || '');
    return `%${utf8ByteLength(s)}%${s}`;
}

// track_meta title/lang length-prefixed DEĞİL; EDL ayraçlarını (; ,) temizle.
function metaSafe(str) {
    return String(str || '').replace(/[;,]/g, ' ').trim();
}

function subCodec(sub) {
    const fmt = String(sub.format || '').toLowerCase();
    if (fmt === 'srt' || /\.srt(\?|$)/i.test(sub.url || '')) return 'subrip';
    return 'webvtt';
}

// videoUrl (m3u8/mp4) + subtitles([{url,lang,label,format}]) → tek edl:// URL.
// Altyazı yoksa null (çağıran orijinal url'yi kullanır).
export function buildMpvEdlUrl(videoUrl, subtitles) {
    const subs = (subtitles || []).filter(s => s && s.url && /^https?:\/\//i.test(s.url));
    if (!videoUrl || !subs.length) return null;

    // Türkçe varsa öne al (mpv ilk sub'ı varsayılan seçmez ama sıralama tutarlı olsun).
    subs.sort((a, b) => {
        const at = /^tr/i.test(a.lang || a.language || '') ? 0 : 1;
        const bt = /^tr/i.test(b.lang || b.language || '') ? 0 : 1;
        return at - bt;
    });

    let edl = 'edl://!no_clip;' + edlQuote(videoUrl);
    for (const sub of subs) {
        const lang = metaSafe(sub.lang || sub.language || 'und');
        const title = metaSafe(sub.label || sub.name || lang) || lang;
        edl += ';!new_stream;!no_clip;!delay_open,media_type=sub,codec=' + subCodec(sub) +
            ';!track_meta,title=' + title + ',lang=' + lang +
            ';' + edlQuote(sub.url);
    }
    return edl;
}

// HLS master metnindeki en yüksek RESOLUTION'dan kalite etiketi ("1080p" vb.)
// çıkarır. Bulamazsa null döner (çağıran 'Auto' kullanır).
export function detectHlsQuality(masterText) {
    const text = String(masterText || '');
    let maxH = 0;
    const re = /RESOLUTION=(\d+)x(\d+)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
        const w = parseInt(m[1], 10);
        const h = parseInt(m[2], 10);
        // Sinematik (ör. 1920x872) içerikte yükseklik düşük olabilir; genişliğin
        // 16:9 karşılığı yüksekliği ile gerçek yüksekliğin büyüğünü al.
        const eq = Math.max(h, Math.round(w * 9 / 16));
        if (eq > maxH) maxH = eq;
    }
    if (!maxH) return null;
    if (maxH >= 2160) return '4K';
    if (maxH >= 1440) return '1440p';
    if (maxH >= 1080) return '1080p';
    if (maxH >= 720) return '720p';
    if (maxH >= 480) return '480p';
    return `${maxH}p`;
}

// Bazı host'lar (ör. vidmixi /list/<blob>) HLS master'ı uzantısız ve
// content-type "text/plain" ile veriyor. mpv/ffmpeg HLS'i uzantı VEYA mime'dan
// tanır; ikisi de yoksa "Not detecting m3u8/hls..." deyip oynatmaz (desktop'ta
// dizifilm'in yüklenmemesinin sebebi buydu). Zararsız bir query eki ("ext=…m3u8")
// ffmpeg'in uzantı eşleştirmesini tetikliyor; sunucu query'yi yok sayıp aynı
// içeriği veriyor, ExoPlayer/AVPlayer query'yi umursamıyor. mpv ile doğrulandı.
export function ensureHlsExtHint(url) {
    const u = String(url || '');
    if (!u || !/^https?:\/\//i.test(u)) return u;
    if (/\.m3u8(\?|#|$)/i.test(u) || /\.mp4(\?|#|$)/i.test(u) || /\.mkv(\?|#|$)/i.test(u)) return u;
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'ext=video.m3u8';
}

// vidmixi gibi host'lar HLS master + variant + audio playlist'lerini uzantısız
// veriyor. FFmpeg 7.0 (Nuvio Desktop) uzantısız CHILD playlist'leri HLS olarak
// açamıyor → master açılsa bile variant takip edilemiyor (1-2 sn döngü). Çözüm:
// master metnindeki variant (STREAM-INF sonrası URL) ve audio (EXT-X-MEDIA URI)
// child playlist URL'lerine ".m3u8" ekle. Segment'ler (.ts içeriği) ffmpeg
// tarafından zaten sniff'lenir, onlara dokunmuyoruz. mpv 8.1 + 7.0'da doğrulandı.
function addM3u8Ext(u) {
    const s = String(u || '').trim();
    if (!s || /\.m3u8(\?|#|$)/i.test(s)) return s;
    const q = s.search(/[?#]/);
    return q >= 0 ? s.slice(0, q) + '.m3u8' + s.slice(q) : s + '.m3u8';
}

export function rewriteMasterChildExt(masterText) {
    return String(masterText || '').split(/\r?\n/).map(line => {
        if (/^#EXT-X-MEDIA/i.test(line)) {
            return line.replace(/URI="([^"]+)"/i, (_, u) => `URI="${addM3u8Ext(u)}"`);
        }
        if (!line.startsWith('#') && /^https?:\/\//i.test(line.trim())) {
            return addM3u8Ext(line);
        }
        return line;
    }).join('\n');
}

// Kullanıcının "embedSubs" ayarı açıksa videoyu altyazılarla edl:// olarak
// birleştirir, değilse url'yi olduğu gibi döndürür. Ayar globalThis.SCRAPER_SETTINGS
// üzerinden gelir (Nuvio her plugin çalıştırmasında enjekte eder).
export function maybeEmbedSubsUrl(url, subtitles, masterText) {
    let on = false;
    try {
        const s = typeof globalThis !== 'undefined' ? globalThis.SCRAPER_SETTINGS : null;
        on = !!(s && s.embedSubs);
    } catch {
        on = false;
    }

    // Ayar KAPALI (mobil/TV): sadece zararsız uzantı ipucu (ExoPlayer/AVPlayer
    // umursamaz; yeni ffmpeg'de HLS algılamasına yardım eder).
    if (!on) return ensureHlsExtHint(url);

    // Ayar AÇIK (Desktop/mpv):
    const hasExt = /\.m3u8(\?|#|$)/i.test(url);
    const subs = (subtitles || []).filter(t => t && t.url && /^https?:\/\//i.test(t.url));

    if (hasExt) {
        // dizibal gibi gerçek .m3u8 URL: ffmpeg 7.0 de algılar. Altyazı varsa
        // edl:// ile birleştir (oynatma + seçilebilir altyazı).
        return subs.length ? (buildMpvEdlUrl(url, subs) || url) : url;
    }

    // Uzantısız URL (dizifilm/vidmixi /list/): master + child playlist'ler
    // uzantısız olduğu için ffmpeg (özellikle 7.0) HLS'i tanımıyor/takip edemiyor.
    // Master'ı memory:// ile ver (mpv içerik sniff'i) VE child playlist URL'lerine
    // .m3u8 ekle ki ffmpeg 7.0 variant'ları takip edebilsin. memory:// edl'e
    // sokulamadığından bu yolda gömülü altyazı yok — öncelik oynatma.
    if (masterText) return 'memory://' + rewriteMasterChildExt(masterText);
    return ensureHlsExtHint(url);
}

// Nuvio ayar diyaloğu için ortak "Desktop altyazı" toggle tanımı. Her provider
// bunu onSettings'ten döndürür; manifest'te "hasSettings": true olmalı.
export function embedSubsSettingsLayout() {
    return [
        { type: 'header', label: 'Desktop Altyazı' },
        {
            type: 'toggle',
            key: 'embedSubs',
            label: 'Masaüstü modu (oynatma + altyazı düzeltmesi)',
            description: 'Nuvio Desktop (MPV) için: bazı kaynaklar masaüstünde oynamaz veya altyazı yüklemez. Bunu AÇARSAN stream masaüstü mpv için uyarlanır (oynatma düzeltmesi + mümkün olan yerde gömülü altyazı). SADECE masaüstünde aç; TV/Android\'de kapalı bırak.',
            defaultValue: false
        }
    ];
}
