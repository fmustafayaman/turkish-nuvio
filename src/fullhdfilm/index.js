import { getTmdbInfo } from '../shared/tmdb.js';
import { DOMAIN_CANDIDATES } from './constants.js';
import { fetchText, decodeScxLink, titlesMatch, normalizeTitle } from './utils.js';
import { extractHost } from './extractors.js';
import { maybeEmbedSubsUrl, embedSubsSettingsLayout, ensureHlsExtHint } from '../shared/hls.js';

const SCX_KEYS = ['atom', 'advid', 'advidprox', 'proton', 'fast', 'fastly', 'tr', 'en'];

function parseSearchResults(html) {
    const results = [];
    const blocks = html.split('<li class="film">').slice(1);
    for (const block of blocks) {
        const href = /<a[^>]*class="tt"[^>]*href="([^"]+)"/.exec(block);
        const title = /<span class="film-title">([^<]+)<\/span>/.exec(block);
        const original = /<span class="kt">([^<]+)<\/span>/.exec(block);
        const year = /<span class="film-yil">\s*(\d{4})\s*<\/span>/.exec(block);
        if (!href || !title) continue;
        results.push({
            url: href[1],
            title: title[1].trim(),
            original: original ? original[1].trim() : '',
            year: year ? year[1] : ''
        });
    }
    return results;
}

function langLabel(key, subKey) {
    const lang = subKey || key;
    if (lang === 'tr') return 'Türkçe Dublaj';
    if (lang === 'en') return 'Altyazılı';
    return 'Türkçe';
}

// scx = {...}; bloğundan dil bazlı host URL'lerini çıkarır.
function parseScx(html) {
    const match = /scx\s*=\s*(\{[\s\S]*?\});/.exec(html);
    if (!match) return [];

    let scx;
    try {
        scx = JSON.parse(match[1]);
    } catch {
        return [];
    }

    const entries = [];
    for (const key of SCX_KEYS) {
        const t = scx[key]?.sx?.t;
        if (!t) continue;

        if (Array.isArray(t)) {
            for (const enc of t) {
                const url = decodeScxLink(enc);
                if (url) entries.push({ url, label: langLabel(key) });
            }
        } else if (typeof t === 'object') {
            for (const subKey of Object.keys(t)) {
                const url = decodeScxLink(t[subKey]);
                if (url) entries.push({ url, label: langLabel(key, subKey) });
            }
        }
    }
    return entries;
}

// Geçici teşhis: Nuvio'da log görünmediği için, akışın hangi aşamada
// takıldığını kaynak listesinde bir satır olarak gösterir.
const DEBUG = false;

function debugStream(msg) {
    return [{
        name: `DEBUG: ${msg}`,
        title: 'FullHDFilm teşhis',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        quality: 'debug',
        headers: {},
        provider: 'fullhdfilm',
        type: 'm3u8'
    }];
}

async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    const steps = [];
    try {
        if (mediaType !== 'movie') {
            return DEBUG ? debugStream(`mediaType=${mediaType} (sadece movie)`) : [];
        }

        const { title, originalTitle, turkishTitle, year } = await getTmdbInfo(tmdbId, 'movie');
        steps.push(`tmdb t="${title}" tr="${turkishTitle}" o="${originalTitle}"`);
        const targets = [...new Set([turkishTitle, title, originalTitle].filter(Boolean))];
        if (!targets.length) {
            return DEBUG ? debugStream(`TMDB boş | ${steps.join(' | ')}`) : [];
        }

        const normTargets = targets.map(normalizeTitle).filter(Boolean);
        let baseUrl = null;
        let candidates = [];
        let fetchErr = '';
        let totalResults = 0;

        for (const domain of DOMAIN_CANDIDATES) {
            const seenUrls = new Set();
            for (const query of targets) {
                let html;
                try {
                    html = await fetchText(`${domain}/arama/${encodeURIComponent(query)}`);
                } catch (e) {
                    fetchErr = `${domain}: ${e.message}`;
                    continue;
                }

                const parsed = parseSearchResults(html);
                totalResults += parsed.length;
                for (const r of parsed) {
                    if (seenUrls.has(r.url)) continue;
                    if (!titlesMatch(r.title, targets) && !titlesMatch(r.original, targets)) continue;
                    seenUrls.add(r.url);

                    // Tam eşleşme (başlık ya da orijinal ad) önceliklidir.
                    const exact = normTargets.includes(normalizeTitle(r.title)) ||
                        normTargets.includes(normalizeTitle(r.original));
                    const yearMatch = year && r.year === String(year);
                    r.score = (exact ? 2 : 0) + (yearMatch ? 1 : 0);
                    candidates.push(r);
                }
            }
            if (candidates.length) {
                baseUrl = domain;
                break;
            }
        }

        steps.push(`arama sonuç=${totalResults} aday=${candidates.length}${fetchErr ? ` err(${fetchErr})` : ''}`);

        if (!candidates.length) {
            return DEBUG ? debugStream(steps.join(' | ')) : [];
        }
        candidates.sort((a, b) => b.score - a.score);

        const referer = `${baseUrl}/`;
        let match = null;
        let entries = [];
        let scxErr = '';

        // En iyi adaydan başlayarak kaynak içeren ilk filmi seç.
        for (const candidate of candidates.slice(0, 5)) {
            let pageHtml;
            try {
                pageHtml = await fetchText(candidate.url);
            } catch (e) {
                scxErr = `sayfa: ${e.message}`;
                continue;
            }
            const parsed = parseScx(pageHtml);
            if (parsed.length) {
                match = candidate;
                entries = parsed;
                break;
            }
        }

        steps.push(`scx entries=${entries.length}${scxErr ? ` ${scxErr}` : ''}`);

        if (!match || !entries.length) {
            return DEBUG ? debugStream(steps.join(' | ')) : [];
        }

        const suffix = year ? ` (${year})` : '';
        const mediaTitle = `${match.title || title}${suffix}`;

        const streams = [];
        const seen = new Set();
        let extractErr = '';

        for (const entry of entries) {
            let hostStreams = [];
            try {
                hostStreams = await extractHost(entry.url, referer);
            } catch (e) {
                extractErr = `${entry.url}: ${e.message}`;
            }
            for (const s of hostStreams) {
                if (!s.url || seen.has(s.url)) continue;
                seen.add(s.url);
                const subs = s.subtitles || [];
                const playUrl = ensureHlsExtHint(s.url);
                streams.push({
                    name: `FullHDFilm ${entry.label} • ${s.host}`,
                    title: mediaTitle,
                    url: maybeEmbedSubsUrl(playUrl, subs),
                    quality: 'Auto',
                    headers: s.headers,
                    provider: 'fullhdfilm',
                    type: s.type,
                    subtitles: subs
                });
            }
        }

        if (!streams.length && DEBUG) {
            const hosts = entries.map(e => e.url.replace(/^https?:\/\//, '').split('/')[0]).join(',');
            return debugStream(`${steps.join(' | ')} | extractor 0 | host=${hosts}${extractErr ? ` err(${extractErr})` : ''}`);
        }

        return streams;
    } catch (e) {
        return DEBUG ? debugStream(`HATA: ${e.message} | ${steps.join(' | ')}`) : [];
    }
}

// Nuvio'nun RN (Hermes) sürümü altyazıyı stream objesinden değil ayrı
// getSubtitles export'undan okur. Kotlin sürümü ise stream.subtitles'ı
// kullanır. Her iki yolu da desteklemek için getStreams'in topladığı
// altyazıları ayrı export olarak da sunuyoruz.
async function getSubtitles(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    try {
        const streams = await getStreams(tmdbId, mediaType, season, episode);
        const subs = [];
        const seen = new Set();
        for (const stream of streams) {
            for (const sub of stream.subtitles || []) {
                if (!sub.url || seen.has(sub.url)) continue;
                seen.add(sub.url);
                const label = sub.name || sub.language || sub.lang || 'Altyazı';
                subs.push({
                    url: sub.url,
                    lang: sub.lang || sub.language || label,
                    label,
                    language: sub.language || label,
                    name: label,
                    format: sub.format || 'vtt'
                });
            }
        }
        return subs;
    } catch {
        return [];
    }
}

async function onSettings() {
    return embedSubsSettingsLayout();
}

module.exports = { getStreams, getSubtitles, onSettings };
