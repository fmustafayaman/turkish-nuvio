import { getTmdbInfo, tmdbApiKeySettingsLayout } from '../shared/tmdb.js';
import { DOMAIN_CANDIDATES } from './constants.js';
import { fetchText, fetchJson, titlesMatch, normalizeTitle } from './utils.js';
import { parseRscPayload, parseTmdbId, parseMovieParts, parseEpisodeEmbeds } from './rsc.js';
import { extractVidlop, extractVidlopSubtitles } from './vidlop.js';
import { extractBepeak, extractBepeakSubtitles, isBepeakUrl } from './bepeak.js';
import { maybeEmbedSubsUrl, embedSubsSettingsLayout } from '../shared/hls.js';

// Part URL'ine göre doğru host extractor'ını seç. dizifilm zamanla farklı
// embed host'ları kullanıyor (vidlop.com/video/ → vidmixi.com/embed/ ...).
function extractHost(url, referer) {
    return isBepeakUrl(url) ? extractBepeak(url, referer) : extractVidlop(url, referer);
}

function extractHostSubtitles(url, referer) {
    return isBepeakUrl(url) ? extractBepeakSubtitles(url, referer) : extractVidlopSubtitles(url, referer);
}

function expectedContentType(mediaType) {
    return mediaType === 'tv' ? 'series' : 'movie';
}

function langLabel(language) {
    const value = String(language || '').trim();
    if (!value) return 'Türkçe';
    if (/dublaj/i.test(value) && /altyaz/i.test(value)) return 'Dublaj & Altyazı';
    if (/dublaj/i.test(value)) return 'Türkçe Dublaj';
    if (/altyaz/i.test(value)) return 'Altyazılı';
    return value;
}

const TR_ASCII_MAP = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u',
    'â': 'a', 'Â': 'a', 'î': 'i', 'Î': 'i', 'û': 'u', 'Û': 'u'
};

function slugify(value) {
    return String(value || '')
        .replace(/[çÇğĞıİöÖşŞüÜâÂîÎûÛ]/g, c => TR_ASCII_MAP[c] || c)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildSlugCandidates(targets) {
    const slugs = new Set();
    for (const target of targets) {
        const slug = slugify(target);
        if (slug) slugs.add(slug);
    }
    return [...slugs];
}

async function searchCandidates(domain, targets, year, contentType) {
    const seenSlugs = new Set();
    const candidates = [];
    const normTargets = targets.map(normalizeTitle).filter(Boolean);

    for (const query of targets) {
        let data;
        try {
            data = await fetchJson(`${domain}/api/search?q=${encodeURIComponent(query)}`);
        } catch {
            continue;
        }

        for (const item of data.results || []) {
            if (!item || !item.slug) continue;
            if (item.content_type !== contentType) continue;
            if (seenSlugs.has(item.slug)) continue;

            seenSlugs.add(item.slug);
            const exact = normTargets.includes(normalizeTitle(item.title));
            const loose = titlesMatch(item.title, targets);
            const yearMatch = year && String(item.year || '') === String(year);
            candidates.push({
                slug: item.slug,
                title: item.title,
                year: item.year || '',
                language_type: item.language_type || '',
                score: (exact ? 3 : loose ? 1 : 0) + (yearMatch ? 1 : 0)
            });
        }
    }

    for (const slug of buildSlugCandidates(targets)) {
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);
        candidates.unshift({
            slug,
            title: '',
            year: '',
            language_type: '',
            score: 2
        });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
}

async function fetchPagePayload(domain, path) {
    const html = await fetchText(`${domain}${path}`);
    return parseRscPayload(html);
}

async function resolveMovie(domain, candidate, tmdbId, referer) {
    const payload = await fetchPagePayload(domain, `/film/${candidate.slug}`);
    const pageTmdb = parseTmdbId(payload);
    if (pageTmdb && String(pageTmdb) !== String(tmdbId)) return null;

    const parts = parseMovieParts(payload);
    if (!parts.length) return null;

    return { candidate, parts, referer: `${domain}/film/${candidate.slug}` };
}

async function resolveEpisode(domain, candidate, tmdbId, season, episode) {
    const path = `/dizi/${candidate.slug}/sezon-${season}/bolum-${episode}`;
    const payload = await fetchPagePayload(domain, path);
    const pageTmdb = parseTmdbId(payload);
    if (pageTmdb && String(pageTmdb) !== String(tmdbId)) return null;

    const embeds = parseEpisodeEmbeds(payload, episode);
    if (!embeds.length) return null;

    return {
        candidate,
        parts: embeds.map((url, index) => ({
            title: embeds.length > 1 ? `Kaynak ${index + 1}` : 'Tek Part',
            url,
            language: candidate.language_type || 'Türkçe',
            quality: 'HD'
        })),
        referer: `${domain}${path}`
    };
}

// Film/dizi bölümünü çözüp vidlop part'larını ve sayfa bilgilerini döndürür.
// Hem getStreams hem getSubtitles tarafından paylaşılır.
async function resolveTarget(tmdbId, mediaType, season, episode) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const { title, originalTitle, turkishTitle, year } = await getTmdbInfo(tmdbId, type);
    const targets = [...new Set([turkishTitle, title, originalTitle].filter(Boolean))];
    if (!targets.length) return null;

    const contentType = expectedContentType(type);
    let resolved = null;

    for (const domain of DOMAIN_CANDIDATES) {
        const candidates = await searchCandidates(domain, targets, year, contentType);
        for (const candidate of candidates.slice(0, 5)) {
            try {
                if (type === 'tv') {
                    resolved = await resolveEpisode(domain, candidate, tmdbId, season, episode);
                } else {
                    resolved = await resolveMovie(domain, candidate, tmdbId, `${domain}/`);
                }
            } catch {
                resolved = null;
            }
            if (resolved) break;
        }
        if (resolved) break;
    }

    if (!resolved || !resolved.parts.length) return null;

    const suffix = year ? ` (${year})` : '';
    resolved.mediaTitle = type === 'tv'
        ? `${resolved.candidate.title || title} S${season}E${episode}`
        : `${resolved.candidate.title || title}${suffix}`;
    return resolved;
}

async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    try {
        console.log(`[Dizifilm v1.6.1] getStreams tmdb=${tmdbId} type=${mediaType} S${season}E${episode}`);
        const resolved = await resolveTarget(tmdbId, mediaType, season, episode);
        if (!resolved) return [];
        const mediaTitle = resolved.mediaTitle;

        const streams = [];
        const seen = new Set();

        for (const part of resolved.parts) {
            let hostStreams = [];
            try {
                hostStreams = await extractHost(part.url, resolved.referer);
            } catch {
                hostStreams = [];
            }

            for (const stream of hostStreams) {
                if (!stream.url || seen.has(stream.url)) continue;
                seen.add(stream.url);

                const label = langLabel(part.language);
                const subs = stream.subtitles || [];
                const quality = stream.quality || part.quality || 'Auto';
                streams.push({
                    name: `Dizifilm ${quality !== 'Auto' ? quality + ' ' : ''}${label} • ${part.title}`,
                    title: mediaTitle,
                    url: maybeEmbedSubsUrl(stream.url, subs, stream.master),
                    quality,
                    headers: stream.headers,
                    provider: 'dizifilm',
                    type: stream.type,
                    subtitles: subs
                });
            }
        }

        return streams;
    } catch {
        return [];
    }
}

// Nuvio yerel scraper'ları altyazıyı stream objesinden değil ayrı
// getSubtitles export'undan okur. Format: { url, lang, label, format }.
async function getSubtitles(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    try {
        const resolved = await resolveTarget(tmdbId, mediaType, season, episode);
        if (!resolved) return [];

        const subs = [];
        const seen = new Set();

        for (const part of resolved.parts) {
            let partSubs = [];
            try {
                partSubs = await extractHostSubtitles(part.url, resolved.referer);
            } catch {
                partSubs = [];
            }
            for (const sub of partSubs) {
                if (!sub.url || seen.has(sub.url)) continue;
                seen.add(sub.url);
                subs.push(sub);
            }
        }

        return subs;
    } catch {
        return [];
    }
}

async function onSettings() {
    return [...embedSubsSettingsLayout(), ...tmdbApiKeySettingsLayout()];
}

module.exports = { getStreams, getSubtitles, onSettings };
