import { BASE_URL, VIDEO_PLAYER, STREAM_HEADERS } from './constants.js';
import { fetchJson, fetchWithRedirect, qualitySortKey, formatSize } from './utils.js';

// Hermes'te global URL bulunmayabilir; pathname ve query'yi elle ayrıştırıyoruz.
function parseEmbedParams(finalUrl) {
    try {
        const str = String(finalUrl || '');
        const queryIndex = str.indexOf('?');
        const pathPart = queryIndex >= 0 ? str.slice(0, queryIndex) : str;
        const queryPart = queryIndex >= 0 ? str.slice(queryIndex + 1) : '';

        let vid = null;
        const vidMatch = /(?:^|&)vid=([^&]*)/.exec(queryPart);
        if (vidMatch) vid = decodeURIComponent(vidMatch[1]);

        const pathname = pathPart.replace(/^https?:\/\/[^/]+/i, '');
        const parts = pathname.replace(/^\/+/, '').split('/').filter(Boolean);

        let embedId = null;
        if (parts.length >= 2 && parts[0] === 'embed') {
            embedId = parts[1];
        } else if (parts.length >= 1) {
            embedId = parts[parts.length - 1];
        }

        return { embedId, vid };
    } catch {
        return { embedId: null, vid: null };
    }
}

function buildEmbedUrl(episodePath) {
    if (episodePath.startsWith('http')) return episodePath;
    return `${BASE_URL}${episodePath.replace(/^\/+/, '')}`;
}

// tau-video embed URL'inden ("https://tau-video.xyz/embed/<id>") id çıkar.
export function parseEmbedIdFromUrl(url) {
    const m = /tau-video\.xyz\/embed[-/]([A-Za-z0-9]+)/i.exec(String(url || ''));
    return m ? m[1] : null;
}

// Doğrudan embedId ile tau-video API'yi çağırıp stream'leri döndürür.
// `vid` GEREKMİYOR — episode-videos'un verdiği embed URL'i ile redirect'e de
// gerek kalmıyor (eski best-video + redirect yolundan daha az istek).
export async function extractByEmbedId(embedId, animeTitle, episodeLabel, subName) {
    if (!embedId) return [];

    const apiUrl = `https://${VIDEO_PLAYER}/api/video/${embedId}`;
    let data;
    try {
        data = await fetchJson(apiUrl, {
            headers: {
                Referer: `https://${VIDEO_PLAYER}/`,
                Origin: `https://${VIDEO_PLAYER}`
            }
        });
    } catch {
        return [];
    }

    const urls = data?.urls || [];
    if (!urls.length) return [];

    const sorted = [...urls].sort((a, b) => qualitySortKey(a.label) - qualitySortKey(b.label));
    const suffix = subName ? ` • ${String(subName).slice(0, 40)}` : '';

    return sorted.map(entry => ({
        name: `Animecix (${entry.label || 'Auto'})${suffix}`,
        title: `${animeTitle} - ${episodeLabel}`,
        url: entry.url,
        quality: entry.label || 'Auto',
        size: formatSize(entry.size),
        headers: STREAM_HEADERS,
        provider: 'animecix',
        type: entry.url.includes('.m3u8') ? 'm3u8' : 'mp4'
    }));
}

export async function extractStreams(episodePath, animeTitle, episodeLabel) {
    const embedUrl = buildEmbedUrl(episodePath);
    const finalUrl = await fetchWithRedirect(embedUrl);
    const { embedId, vid } = parseEmbedParams(finalUrl);

    if (!embedId || !vid) {
        return [];
    }

    const apiUrl = `https://${VIDEO_PLAYER}/api/video/${embedId}?vid=${vid}`;
    const data = await fetchJson(apiUrl, {
        headers: {
            Referer: `https://${VIDEO_PLAYER}/`,
            Origin: `https://${VIDEO_PLAYER}`
        }
    });

    const urls = data?.urls || [];
    if (!urls.length) return [];

    const sorted = [...urls].sort((a, b) => qualitySortKey(a.label) - qualitySortKey(b.label));

    return sorted.map(entry => ({
        name: `Animecix (${entry.label || 'Auto'})`,
        title: `${animeTitle} - ${episodeLabel}`,
        url: entry.url,
        quality: entry.label || 'Auto',
        size: formatSize(entry.size),
        headers: STREAM_HEADERS,
        provider: 'animecix',
        type: entry.url.includes('.m3u8') ? 'm3u8' : 'mp4'
    }));
}
