import { getTmdbInfo, tmdbApiKeySettingsLayout } from '../shared/tmdb.js';
import { withTimeout, timeoutSignal, DEFAULT_TIMEOUT_MS } from '../shared/http.js';
import { maybeEmbedSubsUrl, detectHlsQuality, embedSubsSettingsLayout } from '../shared/hls.js';
import { DOMAIN_CANDIDATES } from './constants.js';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json,text/plain,*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
};

const TR_ASCII_MAP = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u',
    'â': 'a', 'Â': 'a', 'î': 'i', 'Î': 'i', 'û': 'u', 'Û': 'u'
};

function normalizeMediaType(mediaType) {
    const value = String(mediaType || '').toLowerCase();
    return value === 'tv' || value === 'series' || value === 'show' ? 'tv' : 'movie';
}

function normalizeTitle(value) {
    return String(value || '')
        .replace(/[çÇğĞıİöÖşŞüÜâÂîÎûÛ]/g, c => TR_ASCII_MAP[c] || c)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

async function fetchJson(domain, path) {
    return await withTimeout((async () => {
        const response = await fetch(`${domain}${path}`, {
            headers: { ...HEADERS, 'Referer': `${domain}/` },
            signal: timeoutSignal(DEFAULT_TIMEOUT_MS)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${path}`);
        }
        return await response.json();
    })(), DEFAULT_TIMEOUT_MS, path);
}

// Hermes'te URL sınıfı yok; origin'i (scheme://host) elle çıkarıyoruz.
function originOf(url) {
    const match = String(url || '').match(/^(https?:\/\/[^/]+)/i);
    return match ? match[1] : '';
}

async function fetchText(url, referer) {
    return await withTimeout((async () => {
        const response = await fetch(url, {
            headers: {
                'User-Agent': HEADERS['User-Agent'],
                'Accept': '*/*',
                'Accept-Language': HEADERS['Accept-Language'],
                'Referer': referer
            },
            signal: timeoutSignal(DEFAULT_TIMEOUT_MS)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${url}`);
        }
        return await response.text();
    })(), DEFAULT_TIMEOUT_MS, url);
}

async function fetchJsonAt(url, referer, origin) {
    return await withTimeout((async () => {
        const headers = {
            'User-Agent': HEADERS['User-Agent'],
            'Accept': '*/*',
            'Referer': referer
        };
        if (origin) headers['Origin'] = origin;
        const response = await fetch(url, { headers, signal: timeoutSignal(DEFAULT_TIMEOUT_MS) });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${url}`);
        }
        return await response.json();
    })(), DEFAULT_TIMEOUT_MS, url);
}

// Embed HTML'inden playerjs subtitle listesini çıkarır: "[Dil]url,[Dil]url"
function parseEmbedSubtitles(html) {
    const match = html.match(/["']subtitle["']\s*:\s*"([^"]*)"/i);
    if (!match || !match[1]) return [];
    return match[1].split(',').map(part => {
        const m = part.match(/^\s*\[([^\]]*)\]\s*(\S+)\s*$/);
        if (!m) return null;
        const label = m[1].trim();
        const url = m[2].trim();
        const key = normalizeTitle(label); // Türkçe karakterleri ASCII'ye indirger
        const lang = /turk|tr/.test(key) ? 'tr' : (/ing|eng|^en/.test(key) ? 'en' : (key || 'und'));
        return { url, label, lang };
    }).filter(Boolean);
}

function apiPath(path, params = {}) {
    const query = Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
    return `${path}${query ? `?${query}` : ''}`;
}

function itemTitle(item, type) {
    if (!item) return '';
    if (type === 'tv') {
        return item.name_tr || item.name || item.name_en || item.original_name || '';
    }
    return item.title_tr || item.title || item.title_en || item.original_title || '';
}

function itemYear(item, type) {
    const date = type === 'tv' ? item.first_air_date : item.release_date;
    return String(date || '').slice(0, 4);
}

function scoreItem(item, tmdbId, targets, year, type) {
    const idMatch = String(item.id || '') === String(tmdbId);
    const title = normalizeTitle(itemTitle(item, type));
    const exactTitle = targets.map(normalizeTitle).filter(Boolean).includes(title);
    const yearMatch = year && itemYear(item, type) === String(year);
    return (idMatch ? 10 : 0) + (exactTitle ? 3 : 0) + (yearMatch ? 1 : 0);
}

async function searchContent(tmdbId, type, targets, year) {
    const endpoint = type === 'tv' ? '/api/series' : '/api/movies';

    // DOMAIN_CANDIDATES sırayla denenir; ilk sonuç veren domain'de kalınır
    // (fullhdfilm/dizifilm ile aynı desen — site domain'i değişirse diğer
    // adaylara düşer).
    for (const domain of DOMAIN_CANDIDATES) {
        const seen = new Set();
        const candidates = [];

        for (const query of targets) {
            let data;
            try {
                data = await fetchJson(domain, apiPath(endpoint, {
                    search: query,
                    lang: 'tr',
                    siteMode: 'full'
                }));
            } catch {
                continue;
            }

            for (const item of data.data || []) {
                if (!item || !item._id || seen.has(item._id)) continue;
                seen.add(item._id);

                // Aynı başlığın farklı yapımlarını ayır (ör. One Piece anime 1999 vs
                // Netflix canlı-aksiyon 2023). TMDB id birebir eşleşmiyorsa ve yıllar
                // 1'den fazla farklıysa bu FARKLI bir yapımdır — yanlış içeriğe
                // fallback etmemek için ele.
                const idMatch = String(item.id || '') === String(tmdbId);
                const iy = itemYear(item, type);
                if (!idMatch && year && iy && Math.abs(Number(iy) - Number(year)) > 1) continue;

                const score = scoreItem(item, tmdbId, targets, year, type);
                if (score <= 0) continue;
                candidates.push({ item, score });
            }
        }

        if (candidates.length) {
            candidates.sort((a, b) => b.score - a.score);
            return { domain, items: candidates.map(candidate => candidate.item) };
        }
    }

    return { domain: null, items: [] };
}

async function fetchStreamConfig(domain, item, type, season, episode) {
    if (type === 'tv') {
        const seasonNo = season || 1;
        const episodeNo = episode || 1;
        const data = await fetchJson(domain, apiPath(
            `/api/series/${item._id}/seasons/${seasonNo}/episodes/${episodeNo}/stream`,
            { lang: 'tr', siteMode: 'full' }
        ));
        return data.data || null;
    }

    const data = await fetchJson(domain, apiPath(`/api/movies/${item._id}/stream`, {
        lang: 'tr',
        siteMode: 'full'
    }));
    return data.data || null;
}

// Dizibal artık m3u8'i kendi API'sinde çözmüyor; stream config harici bir
// PlayerJS embed host'una (ör. x.ag2m4.cfd) ait streamUrl veriyor. Gerçek m3u8
// o embed sayfasındaki `/dl?op=get_stream&view_id=...&hash=...` çağrısıyla,
// host origin'i Origin header'ı olarak gönderilerek alınır.
async function fetchM3u8(domain, config) {
    const embedUrl = config && config.streamUrl;
    if (!embedUrl) return null;

    const origin = originOf(embedUrl);
    let html;
    try {
        html = await fetchText(embedUrl, `${domain}/`);
    } catch {
        return null;
    }

    const streamParams = (html.match(/op=get_stream&view_id=\d+&hash=[0-9a-f-]+/i) || [])[0];
    if (!streamParams) return null;

    let data;
    try {
        data = await fetchJsonAt(`${origin}/dl?${streamParams}`, embedUrl, origin);
    } catch {
        return null;
    }
    if (!data || !data.url) return null;

    return {
        url: data.url,
        embedOrigin: origin,
        subtitles: parseEmbedSubtitles(html)
    };
}

function streamHeaders(referer) {
    return {
        'User-Agent': HEADERS['User-Agent'],
        'Referer': referer
    };
}

function normalizeSubtitle(sub, referer) {
    if (!sub || !sub.url) return null;
    const lang = sub.lang || (/turk|türk|tr/i.test(sub.label || sub.url) ? 'tr' : 'en');
    const label = sub.label || lang.toUpperCase();
    return {
        url: sub.url,
        lang,
        language: lang,
        label,
        name: label,
        format: /\.srt(\?|$)/i.test(sub.url) ? 'srt' : 'vtt',
        headers: streamHeaders(referer)
    };
}

async function resolveTarget(tmdbId, mediaType, season, episode) {
    const type = normalizeMediaType(mediaType);
    const { title, originalTitle, turkishTitle, year } = await getTmdbInfo(tmdbId, type);
    const targets = [...new Set([turkishTitle, title, originalTitle].filter(Boolean))];
    if (!targets.length) return null;

    const { domain, items } = await searchContent(tmdbId, type, targets, year);
    if (!domain) return null;

    for (const item of items.slice(0, 5)) {
        try {
            const config = await fetchStreamConfig(domain, item, type, season, episode);
            if (!config || !config.src) continue;

            const mediaTitle = type === 'tv'
                ? `${itemTitle(item, type) || title} S${season || 1}E${episode || 1}`
                : `${itemTitle(item, type) || title}${year ? ` (${year})` : ''}`;

            return { item, config, mediaTitle, domain };
        } catch {
            // Try the next candidate.
        }
    }

    return null;
}

async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    try {
        console.log(`[Dizibal v1.3.0] getStreams tmdb=${tmdbId} type=${mediaType} S${season}E${episode}`);
        const resolved = await resolveTarget(tmdbId, mediaType, season, episode);
        if (!resolved) return [];

        const extracted = await fetchM3u8(resolved.domain, resolved.config);
        if (!extracted || !extracted.url) return [];

        // m3u8 CDN'i embed host'unun Referer'ını ister; origin seviyesi yeterli.
        const referer = extracted.embedOrigin ? `${extracted.embedOrigin}/` : `${resolved.domain}/`;
        const subtitles = extracted.subtitles
            .map(sub => normalizeSubtitle(sub, referer))
            .filter(Boolean);

        // Master'ı bir kez çek: kalite etiketi + masaüstü modu dönüşümü için.
        let masterText = null;
        try {
            masterText = await fetchText(extracted.url, referer);
        } catch {
            masterText = null;
        }
        const quality = detectHlsQuality(masterText || '') || 'Auto';

        // Masaüstü modu (ayar açıksa): dizibal URL'i .m3u8 olduğu için edl ile
        // video + altyazı birleşir. maybeEmbedSubsUrl kapalıyken url'yi korur.
        const streamUrl = maybeEmbedSubsUrl(extracted.url, subtitles, masterText);
        if (streamUrl !== extracted.url) {
            console.log(`[Dizibal v1.2.5] masaüstü modu: stream dönüştürüldü (${subtitles.length} altyazı)`);
        }

        return [{
            name: `Dizibal ${quality}`.trim(),
            title: resolved.mediaTitle,
            url: streamUrl,
            quality,
            provider: 'dizibal',
            type: 'm3u8',
            headers: streamHeaders(referer),
            subtitles
        }];
    } catch {
        return [];
    }
}

// Nuvio, plugin ayarlarını bu layout'a göre çizer; değerler globalThis.SCRAPER_SETTINGS'e gelir.
async function onSettings() {
    return [...embedSubsSettingsLayout(), ...tmdbApiKeySettingsLayout()];
}

async function getSubtitles(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    try {
        const streams = await getStreams(tmdbId, mediaType, season, episode);
        const seen = new Set();
        const subtitles = [];
        for (const stream of streams) {
            for (const sub of stream.subtitles || []) {
                if (!sub.url || seen.has(sub.url)) continue;
                seen.add(sub.url);
                subtitles.push(sub);
            }
        }
        return subtitles;
    } catch {
        return [];
    }
}

module.exports = { getStreams, getSubtitles, onSettings };
