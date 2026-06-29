import { getTmdbInfo } from '../shared/tmdb.js';
import { withTimeout, timeoutSignal, DEFAULT_TIMEOUT_MS } from '../shared/http.js';

const BASE_URL = 'https://dizibal.com';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json,text/plain,*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
    'Referer': `${BASE_URL}/`
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

async function fetchJson(path) {
    return await withTimeout((async () => {
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: HEADERS,
            signal: timeoutSignal(DEFAULT_TIMEOUT_MS)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${path}`);
        }
        return await response.json();
    })(), DEFAULT_TIMEOUT_MS, path);
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
    const seen = new Set();
    const candidates = [];

    for (const query of targets) {
        let data;
        try {
            data = await fetchJson(apiPath(endpoint, {
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

            const score = scoreItem(item, tmdbId, targets, year, type);
            if (score <= 0) continue;
            candidates.push({ item, score });
        }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.map(candidate => candidate.item);
}

async function fetchStreamConfig(item, type, season, episode) {
    if (type === 'tv') {
        const seasonNo = season || 1;
        const episodeNo = episode || 1;
        const data = await fetchJson(apiPath(
            `/api/series/${item._id}/seasons/${seasonNo}/episodes/${episodeNo}/stream`,
            { lang: 'tr', siteMode: 'full' }
        ));
        return data.data || null;
    }

    const data = await fetchJson(apiPath(`/api/movies/${item._id}/stream`, {
        lang: 'tr',
        siteMode: 'full'
    }));
    return data.data || null;
}

async function fetchM3u8(src) {
    const data = await fetchJson(apiPath('/api/stream/m3u8', {
        code: src,
        siteMode: 'full'
    }));
    if (!data || data.success === false || !data.m3u8Url) return null;
    return {
        url: data.m3u8Url,
        subtitles: Array.isArray(data.subtitles) ? data.subtitles : []
    };
}

function streamHeaders(referer) {
    return {
        'User-Agent': HEADERS['User-Agent'],
        'Referer': referer || BASE_URL
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

    const candidates = await searchContent(tmdbId, type, targets, year);
    for (const item of candidates.slice(0, 5)) {
        try {
            const config = await fetchStreamConfig(item, type, season, episode);
            if (!config || !config.src) continue;

            const mediaTitle = type === 'tv'
                ? `${itemTitle(item, type) || title} S${season || 1}E${episode || 1}`
                : `${itemTitle(item, type) || title}${year ? ` (${year})` : ''}`;

            return { item, config, mediaTitle };
        } catch {
            // Try the next candidate.
        }
    }

    return null;
}

async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    try {
        const resolved = await resolveTarget(tmdbId, mediaType, season, episode);
        if (!resolved) return [];

        const extracted = await fetchM3u8(resolved.config.src);
        if (!extracted || !extracted.url) return [];

        const referer = resolved.config.streamUrl || `${BASE_URL}/`;
        const subtitles = extracted.subtitles
            .map(sub => normalizeSubtitle(sub, referer))
            .filter(Boolean);

        return [{
            name: 'Dizibal',
            title: resolved.mediaTitle,
            url: extracted.url,
            quality: 'Auto',
            provider: 'dizibal',
            type: 'm3u8',
            headers: streamHeaders(referer),
            subtitles
        }];
    } catch {
        return [];
    }
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

module.exports = { getStreams, getSubtitles };
