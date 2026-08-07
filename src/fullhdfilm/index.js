import { getTmdbInfo, tmdbApiKeySettingsLayout } from '../shared/tmdb.js';
import { decodeBase64 } from '../shared/base64.js';
import { DOMAIN_CANDIDATES } from './constants.js';
import { fetchText, postForm, decodeScxLink, titlesMatch, normalizeTitle } from './utils.js';
import { extractHost } from './extractors.js';
import { maybeEmbedSubsUrl, embedSubsSettingsLayout, ensureHlsExtHint } from '../shared/hls.js';

const SCX_KEYS = ['atom', 'advid', 'advidprox', 'proton', 'fast', 'fastly', 'tr', 'en'];

// Eski site şablonu: <li class="film"> + film-title
function parseLegacySearchResults(html) {
    const results = [];
    const blocks = html.split('<li class="film">').slice(1);
    for (const block of blocks) {
        const href = /<a[^>]*class="tt"[^>]*href="([^"]+)"/.exec(block)
            || /href="([^"]+)"/.exec(block);
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

// Yeni site ajax_search HTML'i:
// <li> <a title="Kara Şövalye" href="https://fullhdfilmizlesene.co/kara-sovalye-izle"> ...
function parseAjaxSearchResults(html) {
    const results = [];
    const seen = new Set();

    const push = (title, url) => {
        if (!title || !url || seen.has(url)) return;
        if (/youtube|pinterest|reddit|facebook|twitter/i.test(url)) return;
        if (!/-izle/i.test(url) && !/\/film\//i.test(url)) return;
        seen.add(url);
        results.push({ url, title: title.trim(), original: '', year: '' });
    };

    for (const m of html.matchAll(/<a[^>]*title="([^"]+)"[^>]*href="([^"]+)"/gi)) {
        push(m[1], m[2]);
    }
    for (const m of html.matchAll(/<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"/gi)) {
        push(m[2], m[1]);
    }

    return results;
}

function langLabel(key, subKey) {
    const lang = subKey || key;
    if (lang === 'tr' || /dublaj/i.test(lang)) return 'Türkçe Dublaj';
    if (lang === 'en' || /altyaz/i.test(lang)) return 'Altyazılı';
    if (/fragman/i.test(lang)) return 'Fragman';
    return 'Türkçe';
}

// part id → etiket (turkcedublaj0, turkcealtyazili1, 0, 1, ...)
function partLabel(partId) {
    const id = String(partId || '');
    if (/fragman/i.test(id)) return 'Fragman';
    if (/dublaj/i.test(id)) return 'Türkçe Dublaj';
    if (/altyaz/i.test(id)) return 'Altyazılı';
    return 'Türkçe';
}

// scx = {...}; bloğundan dil bazlı host URL'lerini çıkarır (eski şablon).
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

// Yeni site: pdata['prt_<id>'] = base64 (prefix ters çevrilmiş string ile birleşir)
// rvali('BSZtFmcmlGP') === 'PGlmcmFtZSB' === base64('<iframe ')
function reverseString(s) {
    let out = '';
    for (let i = s.length - 1; i >= 0; i--) out += s[i];
    return out;
}

function parsePdata(html) {
    const entries = [];
    // Prefix sitede rvali('BSZtFmcmlGP') ile üretiliyor → reverse → 'PGlmcmFtZSB' (<iframe )
    const prefixKeyMatch = /rvali\(['"]([A-Za-z0-9+/=]+)['"]\)/.exec(html);
    const prefix = reverseString(prefixKeyMatch ? prefixKeyMatch[1] : 'BSZtFmcmlGP');
    // img placeholder base64 başlangıcı — bu durumda prefix eklenmez
    const imgPrefix = 'PGltZyB3aWR0aD0iMTAwJSIgaGVpZ2';

    const re = /pdata\[['"]prt_([^'"]+)['"]\]\s*=\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const partId = m[1];
        const data = m[2];
        if (/fragman/i.test(partId)) continue;

        const full = data.substring(0, 30) === imgPrefix ? data : (prefix + data);
        let iframeHtml;
        try {
            iframeHtml = decodeBase64(full);
        } catch {
            continue;
        }
        if (!iframeHtml) continue;

        const src = /src\s*=\s*["']([^"']+)["']/i.exec(iframeHtml);
        if (!src || !src[1]) continue;
        const url = src[1].trim().replace(/\s+/g, '');
        if (!/^https?:\/\//i.test(url)) continue;
        if (/youtube\.com|youtu\.be/i.test(url)) continue;

        entries.push({ url, label: partLabel(partId), partId });
    }
    return entries;
}

// Film sayfasından embed URL'leri (yeni pdata veya eski scx).
function parsePlayerEntries(html) {
    const pdata = parsePdata(html);
    if (pdata.length) return pdata;
    return parseScx(html);
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

async function searchOnDomain(domain, targets) {
    const candidates = [];
    const seenUrls = new Set();
    let totalResults = 0;
    let fetchErr = '';
    const origin = domain.replace(/\/+$/, '');
    const referer = `${origin}/`;

    for (const query of targets) {
        // 1) Yeni ajax_search (önerilen)
        try {
            const body = `action=ajax_search&arama_kelime=${encodeURIComponent(query)}`;
            const html = await postForm(`${origin}/arama/`, body, { referer, origin });
            const parsed = parseAjaxSearchResults(html);
            totalResults += parsed.length;
            for (const r of parsed) {
                if (seenUrls.has(r.url)) continue;
                if (!titlesMatch(r.title, targets) && !titlesMatch(r.original, targets)) continue;
                seenUrls.add(r.url);
                const exact = targets.map(normalizeTitle).includes(normalizeTitle(r.title)) ||
                    targets.map(normalizeTitle).includes(normalizeTitle(r.original));
                r.score = exact ? 2 : 1;
                candidates.push(r);
            }
        } catch (e) {
            fetchErr = `ajax:${e.message}`;
        }

        // 2) Eski GET /arama/<query>
        try {
            const html = await fetchText(`${origin}/arama/${encodeURIComponent(query)}`);
            const parsed = parseLegacySearchResults(html);
            totalResults += parsed.length;
            for (const r of parsed) {
                if (seenUrls.has(r.url)) continue;
                if (!titlesMatch(r.title, targets) && !titlesMatch(r.original, targets)) continue;
                seenUrls.add(r.url);
                const exact = targets.map(normalizeTitle).includes(normalizeTitle(r.title)) ||
                    targets.map(normalizeTitle).includes(normalizeTitle(r.original));
                const yearMatch = false;
                r.score = (exact ? 2 : 0) + (yearMatch ? 1 : 0);
                candidates.push(r);
            }
        } catch (e) {
            fetchErr = fetchErr || `get:${e.message}`;
        }

        // 3) GET /arama/?s=
        try {
            const html = await fetchText(`${origin}/arama/?s=${encodeURIComponent(query)}`);
            const parsed = [
                ...parseLegacySearchResults(html),
                ...parseAjaxSearchResults(html)
            ];
            totalResults += parsed.length;
            for (const r of parsed) {
                if (seenUrls.has(r.url)) continue;
                if (!titlesMatch(r.title, targets) && !titlesMatch(r.original, targets)) continue;
                seenUrls.add(r.url);
                r.score = 1;
                candidates.push(r);
            }
        } catch {
            // yoksay
        }
    }

    return { candidates, totalResults, fetchErr };
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
            const found = await searchOnDomain(domain, targets);
            totalResults += found.totalResults;
            if (found.fetchErr) fetchErr = found.fetchErr;

            for (const r of found.candidates) {
                // Yıl skoru (varsa)
                if (year && r.year === String(year)) r.score = (r.score || 0) + 1;
                // Tam eşleşme güçlendir
                if (normTargets.includes(normalizeTitle(r.title)) ||
                    normTargets.includes(normalizeTitle(r.original))) {
                    r.score = Math.max(r.score || 0, 2);
                }
            }

            if (found.candidates.length) {
                baseUrl = domain.replace(/\/+$/, '');
                candidates = found.candidates;
                break;
            }
        }

        steps.push(`arama sonuç=${totalResults} aday=${candidates.length}${fetchErr ? ` err(${fetchErr})` : ''}`);

        if (!candidates.length) {
            return DEBUG ? debugStream(steps.join(' | ')) : [];
        }
        candidates.sort((a, b) => (b.score || 0) - (a.score || 0));

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
            const parsed = parsePlayerEntries(pageHtml);
            if (parsed.length) {
                match = candidate;
                entries = parsed;
                break;
            }
        }

        steps.push(`player entries=${entries.length}${scxErr ? ` ${scxErr}` : ''}`);

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
    return [...embedSubsSettingsLayout(), ...tmdbApiKeySettingsLayout()];
}

module.exports = { getStreams, getSubtitles, onSettings };
