function unescapeRscChunk(chunk) {
    return String(chunk || '')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        );
}

export function parseRscPayload(html) {
    const chunks = [];
    const re = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;
    let match;
    while ((match = re.exec(html)) !== null) {
        chunks.push(unescapeRscChunk(match[1]));
    }
    return chunks.join('');
}

export function parseTmdbId(payload) {
    const match = /"tmdb_id":(?:"(\d+)"|(\d+))/.exec(payload || '');
    if (!match) return null;
    return match[1] || match[2];
}

// Bir part URL'inin oynatılabilir bir embed host'una işaret edip etmediği.
// Host bağımsız: dizifilm zamanla vidlop.com/video/ → vidmixi.com/embed/ gibi
// host değiştiriyor, o yüzden belirli bir domain'e bağlanmıyoruz.
function isPlayableEmbed(url) {
    return /^https?:\/\//i.test(url) && /\/(embed|video)\/[^"'\s]+/i.test(url);
}

export function parseMovieParts(payload) {
    const match = /"parts":(\[[^\]]*\])/.exec(payload || '');
    if (!match) return [];

    try {
        const parts = JSON.parse(match[1]);
        return (parts || [])
            .filter(p => p && p.url && isPlayableEmbed(String(p.url).replace(/\\\//g, '/')))
            .map(p => ({
                title: String(p.title || 'Tek Part').trim(),
                url: String(p.url).replace(/\\\//g, '/'),
                language: String(p.language || 'Türkçe').trim(),
                quality: String(p.quality || 'HD').trim()
            }));
    } catch {
        const parts = [];
        const re = /"url":"(https?:(?:\\\/|\/)[^"]*?(?:\\\/|\/)(?:embed|video)(?:\\\/|\/)[^"]+)","language":"([^"]*)"/g;
        let m;
        while ((m = re.exec(payload)) !== null) {
            parts.push({
                title: 'Tek Part',
                url: m[1].replace(/\\\//g, '/'),
                language: m[2] || 'Türkçe',
                quality: 'HD'
            });
        }
        return parts;
    }
}

// Bölüm sayfasının RSC payload'ı sezondaki TÜM bölümlerin embed URL'lerini
// içerir (bölüm listesi + prev/next nav). Embed'i, kendisinden önce gelen son
// "episode_number" hedef bölümse al — yoksa payload'daki ilk embed hangi
// bölümünse (genelde sezonun 1. bölümü) o oynar.
export function parseEpisodeEmbeds(payload, episode) {
    const urls = [];
    const target = episode == null ? null : Number(episode);
    const re = /"episode_number":(\d+)|"embed_player_url_[12]":"(https?:(?:\\\/|\/)[^"]+)"/g;
    let currentEpisode = null;
    let match;
    while ((match = re.exec(payload || '')) !== null) {
        if (match[1] !== undefined) {
            currentEpisode = Number(match[1]);
            continue;
        }
        if (target !== null && currentEpisode !== target) continue;
        const url = match[2].replace(/\\\//g, '/');
        if (isPlayableEmbed(url) && !urls.includes(url)) urls.push(url);
    }
    return urls;
}
