// Desktop (Nuvio Kotlin/MPV) native player, sağlayıcının döndürdüğü
// externalSubtitles listesini MPV'ye iletmiyor (app bug; PR #168). Workaround:
// altyazıyı HLS master playlist'in İÇİNE bir SUBTITLES rendition olarak gömüp
// tüm stream'i bir `data:` URI olarak döndürmek — MPV in-manifest altyazıyı
// otomatik yükler, app düzeltmesine gerek kalmaz. Sadece kullanıcı ayarı
// açıkken uygulanır; kapalıyken normal davranış korunur (TV/Android bozulmaz).

function absolutize(url, baseUrl) {
    const u = String(url || '').trim();
    if (/^https?:\/\//i.test(u) || /^data:/i.test(u)) return u;
    const base = String(baseUrl || '');
    if (u.startsWith('/')) {
        const m = base.match(/^(https?:\/\/[^/]+)/i);
        return m ? m[1] + u : u;
    }
    const slash = base.lastIndexOf('/');
    return slash >= 0 ? base.slice(0, slash + 1) + u : u;
}

// Tek bir .vtt/.srt'yi saran HLS altyazı medya playlist'i (data: URI).
function subtitlePlaylistDataUri(subUrl) {
    const playlist = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:99999',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-PLAYLIST-TYPE:VOD',
        '#EXTINF:99999.0,',
        subUrl,
        '#EXT-X-ENDLIST',
        ''
    ].join('\n');
    return 'data:application/vnd.apple.mpegurl,' + encodeURIComponent(playlist);
}

function subMediaLine(sub, groupId, isDefault) {
    const lang = sub.lang || sub.language || 'und';
    const name = (sub.label || sub.name || lang).replace(/"/g, '');
    const uri = subtitlePlaylistDataUri(sub.url);
    return `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="${groupId}",NAME="${name}",` +
        `DEFAULT=${isDefault ? 'YES' : 'NO'},AUTOSELECT=YES,FORCED=NO,` +
        `LANGUAGE="${lang}",URI="${uri}"`;
}

// masterText: uzak master playlist'in ham metni. Variant'ları (ve varsa audio
// rendition'larını) aynen koruyup her #EXT-X-STREAM-INF'e SUBTITLES grubunu
// bağlar, başa da altyazı medya satırlarını ekler. Sonucu data: URI döndürür.
// Master değilse (medya playlist) ya da altyazı yoksa null döner (çağıran orijinali kullanır).
export function buildSubtitleHlsDataUri(masterUrl, masterText, subtitles) {
    const subs = (subtitles || []).filter(s => s && s.url && /^https?:\/\//i.test(s.url));
    if (!subs.length) return null;
    const text = String(masterText || '');
    if (!/#EXT-X-STREAM-INF/i.test(text)) return null; // medya playlist: gömme yapılamaz

    const groupId = 'subs';
    // Türkçe altyazı varsa onu varsayılan seç, yoksa ilkini.
    let defaultIdx = subs.findIndex(s => /^tr/i.test(s.lang || s.language || ''));
    if (defaultIdx < 0) defaultIdx = 0;

    const lines = text.split(/\r?\n/);
    const out = [];
    let injected = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (/^#EXTM3U/i.test(line) && !injected) {
            out.push(line);
            subs.forEach((sub, idx) => out.push(subMediaLine(sub, groupId, idx === defaultIdx)));
            injected = true;
            continue;
        }

        // Variant satırına altyazı grubunu bağla.
        if (/^#EXT-X-STREAM-INF/i.test(line)) {
            if (!/SUBTITLES=/i.test(line)) line = line + `,SUBTITLES="${groupId}"`;
            out.push(line);
            // Bir sonraki boş olmayan satır variant URI'sidir; mutlaklaştır.
            if (i + 1 < lines.length) {
                const uriLine = lines[i + 1];
                if (uriLine && !uriLine.startsWith('#')) {
                    out.push(absolutize(uriLine, masterUrl));
                    i++;
                }
            }
            continue;
        }

        // Audio vb. EXT-X-MEDIA URI'lerini mutlaklaştır.
        if (/^#EXT-X-MEDIA/i.test(line) && /URI="/i.test(line)) {
            line = line.replace(/URI="([^"]+)"/i, (_, u) => `URI="${absolutize(u, masterUrl)}"`);
        }

        out.push(line);
    }

    if (!injected) return null;
    return 'data:application/vnd.apple.mpegurl,' + encodeURIComponent(out.join('\n'));
}
