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

// Kullanıcının "embedSubs" ayarı açıksa videoyu altyazılarla edl:// olarak
// birleştirir, değilse url'yi olduğu gibi döndürür. Ayar globalThis.SCRAPER_SETTINGS
// üzerinden gelir (Nuvio her plugin çalıştırmasında enjekte eder).
export function maybeEmbedSubsUrl(url, subtitles) {
    let on = false;
    try {
        const s = typeof globalThis !== 'undefined' ? globalThis.SCRAPER_SETTINGS : null;
        on = !!(s && s.embedSubs);
    } catch {
        on = false;
    }
    if (!on) return url;
    return buildMpvEdlUrl(url, subtitles) || url;
}

// Nuvio ayar diyaloğu için ortak "Desktop altyazı" toggle tanımı. Her provider
// bunu onSettings'ten döndürür; manifest'te "hasSettings": true olmalı.
export function embedSubsSettingsLayout() {
    return [
        { type: 'header', label: 'Desktop Altyazı' },
        {
            type: 'toggle',
            key: 'embedSubs',
            label: 'Altyazıyı stream içine göm (Desktop)',
            description: 'Nuvio Desktop (MPV) external altyazıyı yüklemiyor. Bunu AÇARSAN altyazı, mpv edl:// ile videonun içine gömülür ve player menüsünde görünür. TV/Android\'de gerekmez, kapalı bırak.',
            defaultValue: false
        }
    ];
}
