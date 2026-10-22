import { getTmdbInfo, tmdbApiKeySettingsLayout } from '../shared/tmdb.js';
import { withTimeout, timeoutSignal, DEFAULT_TIMEOUT_MS } from '../shared/http.js';
import { buildMpvEdlUrl, ensureHlsExtHint, detectHlsQuality, embedSubsSettingsLayout } from '../shared/hls.js';
import { DOMAIN_CANDIDATES, SITE_HEADERS } from './constants.js';

const VERSION = '1.4.1';

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

async function fetchText(url, referer, accept) {
    return await withTimeout((async () => {
        const headers = { ...SITE_HEADERS };
        if (accept) headers['Accept'] = accept;
        if (referer) headers['Referer'] = referer;
        const response = await fetch(url, { headers, signal: timeoutSignal(DEFAULT_TIMEOUT_MS) });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${url}`);
        }
        return await response.text();
    })(), DEFAULT_TIMEOUT_MS, url);
}

// "/ara/oneri?q=" → { movies: [{type,title,url,poster,meta}], series: [...] }.
// Anime'ler de "series" altında gelir (url'leri /anime/<slug>).
async function suggest(domain, query) {
    const text = await fetchText(
        `${domain}/ara/oneri?q=${encodeURIComponent(query)}`,
        `${domain}/`,
        'application/json'
    );
    return JSON.parse(text);
}

function metaYear(meta) {
    const match = String(meta || '').match(/(\d{4})/);
    return match ? match[1] : '';
}

// Site TMDB görsellerini aynı dosya adıyla sunuyor: ".../posters/w780/<ad>.webp".
function posterKey(value) {
    const name = String(value || '').split('/').pop() || '';
    return name.replace(/\.[a-z0-9]+$/i, '');
}

// Eşleşme puanı; null = bu içerik kesinlikle hedef değil.
// Poster eşleşmesi başlıktan bağımsız kesin kanıt. Poster yoksa tam başlık
// eşleşmesi şart ve yıl biliniyorsa tutmalı (aynı adlı farklı yapımlara
// düşmemek için — ör. "One Day" 2011 film vs 2024 dizi).
function scoreItem(item, targets, year, posterPath) {
    const posterMatch = !!posterPath && posterKey(item.poster) === posterKey(posterPath);
    if (posterMatch) return 100;

    const title = normalizeTitle(item.title);
    if (!title || !targets.includes(title)) return null;

    const itemYear = metaYear(item.meta);
    if (year && itemYear) {
        const diff = Math.abs(Number(itemYear) - Number(year));
        if (diff > 1) return null;
        return diff === 0 ? 20 : 15;
    }
    return 10;
}

async function searchContent(type, titles, year, posterPath) {
    const group = type === 'tv' ? 'series' : 'movies';
    const targets = titles.map(normalizeTitle).filter(Boolean);

    for (const domain of DOMAIN_CANDIDATES) {
        const byUrl = new Map();
        let reachable = false;
        for (const query of titles) {
            let data;
            try {
                data = await suggest(domain, query);
                reachable = true;
            } catch {
                continue;
            }
            for (const item of (data && data[group]) || []) {
                if (!item || !item.url || byUrl.has(item.url)) continue;
                const score = scoreItem(item, targets, year, posterPath);
                if (score !== null) byUrl.set(item.url, { item, score });
            }
            // Kesin (poster) eşleşme bulunduysa diğer başlıkları aramaya gerek yok.
            if ([...byUrl.values()].some(c => c.score >= 100)) break;
        }
        if (!reachable) continue;

        const items = [...byUrl.values()]
            .sort((a, b) => b.score - a.score)
            .map(c => c.item);
        return { domain, items };
    }
    return { domain: null, items: [] };
}

function pageUrlFor(item, type, season, episode) {
    const base = String(item.url).replace(/\/+$/, '');
    return type === 'tv' ? `${base}/season/${season || 1}/episode/${episode || 1}` : base;
}

// İçerik sayfasında player, HTML'e yalnızca opak bir slug + loader script'i
// olarak gömülü: <div data-pv="SLUG"> + <script src="https://HOST/assets/js/core.js">.
// core.js bunu HOST/assets/js/s.php?s=SLUG iframe'ine çeviriyor.
function parsePlayerEmbed(html) {
    if (/data-player-type="none"/i.test(html)) return null;
    const slug = (html.match(/data-pv="([^"]+)"/i) || [])[1];
    const loader = (html.match(/<script[^>]+src="(https?:\/\/[^"]+?)\/(?:assets\/js\/core|e\/c)\.js[^"]*"/i) || [])[1];
    if (!slug || !loader) return null;
    return { slug, host: loader.replace(/\/+$/, '') };
}

// s.php sayfası (origin kilitli: Referer dizibal olmalı) oynatıcı config'ini
// window.__PLAYER__ = {...} olarak içeriyor: tokenlı HLS master, altyazılar, ses izleri.
function parsePlayerConfig(html) {
    const match = html.match(/window\.__PLAYER__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
    if (!match) return null;
    try {
        const config = JSON.parse(match[1]);
        return config && config.stream ? config : null;
    } catch {
        return null;
    }
}

async function fetchPlayer(domain, pageUrl) {
    const html = await fetchText(pageUrl, `${domain}/`);
    const embed = parsePlayerEmbed(html);
    if (!embed) return null;

    const playerUrl = `${embed.host}/assets/js/s.php?s=${encodeURIComponent(embed.slug)}`;
    const playerHtml = await fetchText(playerUrl, `${domain}/`);
    const config = parsePlayerConfig(playerHtml);
    if (!config) return null;
    return { config, host: embed.host };
}

function streamHeaders(host) {
    return {
        'User-Agent': SITE_HEADERS['User-Agent'],
        'Referer': `${host}/`,
        'Origin': host
    };
}

function normalizeSubtitles(subs, host) {
    return (subs || []).map(sub => {
        if (!sub || !sub.src) return null;
        const lang = String(sub.lang || '').toLowerCase() || 'und';
        const label = sub.label || lang.toUpperCase();
        return {
            url: sub.src,
            lang,
            language: lang,
            label,
            name: label,
            format: 'vtt',
            headers: streamHeaders(host)
        };
    }).filter(Boolean)
        // Türkçe altyazı önce.
        .sort((a, b) => (a.lang === 'tr' ? 0 : 1) - (b.lang === 'tr' ? 0 : 1));
}

// "Türkçe Dublaj · Orijinal (EN)" gibi kısa ses izi özeti (başlıkta gösterilir).
// Site orijinal sesi "Orijinal 2" gibi sıra numarasıyla etiketliyor; dili yazıyoruz.
function audioSummary(audios) {
    const labels = (audios || []).filter(a => a && a.label).map(a => {
        if (!/^orijinal/i.test(a.label)) return a.label;
        const lang = String(a.lang || '').toUpperCase();
        return lang && lang !== 'TR' ? `Orijinal (${lang})` : 'Orijinal';
    });
    return labels.join(' · ');
}

// Tek varyantlı (RESOLUTION'suz) playlist'lerde kalite sürüm adından gelir:
// "Game.of.Thrones.S01E01.1080p.WebDL..." → "1080p".
function qualityFromRelease(name) {
    const match = String(name || '').match(/(2160|1440|1080|720|480)p/i);
    if (!match) return null;
    return match[1] === '2160' ? '4K' : `${match[1]}p`;
}

// Master'ın ayrı AUDIO rendition'ları (TR dublaj + orijinal) ve doğru HLS mime'ı
// var; ffmpeg 7.0 (Desktop) mime'dan tanıyor, bu yüzden memory:// dönüşümüne
// gerek yok. Masaüstü modu açıksa yalnızca altyazılar edl:// ile birleştirilir.
function playbackUrl(url, subtitles) {
    let desktop = false;
    try {
        const s = typeof globalThis !== 'undefined' ? globalThis.SCRAPER_SETTINGS : null;
        desktop = !!(s && s.embedSubs);
    } catch {
        desktop = false;
    }
    const hinted = ensureHlsExtHint(url);
    if (!desktop) return hinted;
    return buildMpvEdlUrl(hinted, subtitles) || hinted;
}

// Geçici teşhis: Nuvio'da log görünmediği için, akışın hangi aşamada
// takıldığını kaynak listesinde bir satır olarak gösterir (bkz. fullhdfilm).
const DEBUG = false;

function debugStream(msg) {
    return [{
        name: `DEBUG: ${msg}`,
        title: 'Dizibal teşhis',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        quality: 'debug',
        headers: {},
        provider: 'dizibal',
        type: 'm3u8'
    }];
}

// `steps` verilirse (yalnızca getStreams'in DEBUG modu) her aşamayı teşhis için biriktirir.
async function resolveTarget(tmdbId, mediaType, season, episode, steps) {
    const type = normalizeMediaType(mediaType);
    const { title, originalTitle, turkishTitle, year, posterPath } = await getTmdbInfo(tmdbId, type);
    const titles = [...new Set([turkishTitle, title, originalTitle].filter(Boolean))];
    steps?.push(`tmdb t="${title}" tr="${turkishTitle}" o="${originalTitle}" y=${year}`);
    if (!titles.length) return null;

    const { domain, items } = await searchContent(type, titles, year, posterPath);
    steps?.push(`arama domain=${domain || 'yok'} aday=${items.length}`);
    if (!domain) return null;

    for (const item of items.slice(0, 3)) {
        const pageUrl = pageUrlFor(item, type, season, episode);
        try {
            const player = await fetchPlayer(domain, pageUrl);
            if (!player) {
                steps?.push(`player yok: ${pageUrl}`);
                continue;
            }
            const name = item.title || title;
            const mediaTitle = type === 'tv'
                ? `${name} S${season || 1}E${episode || 1}`
                : `${name}${year ? ` (${year})` : ''}`;
            return { ...player, mediaTitle };
        } catch (e) {
            steps?.push(`hata ${pageUrl}: ${e.message}`);
        }
    }
    return null;
}

async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    const steps = [];
    try {
        console.log(`[Dizibal v${VERSION}] getStreams tmdb=${tmdbId} type=${mediaType} S${season}E${episode}`);
        const resolved = await resolveTarget(tmdbId, mediaType, season, episode, steps);
        if (!resolved) return DEBUG ? debugStream(steps.join(' | ')) : [];

        const { config, host, mediaTitle } = resolved;
        const headers = streamHeaders(host);
        const subtitles = normalizeSubtitles(config.subs, host);

        // Master'ı bir kez çek: hem erişilebilirliği doğrular hem kalite etiketini verir.
        let masterText = '';
        try {
            masterText = await fetchText(config.stream, `${host}/`, '*/*');
        } catch (e) {
            steps.push(`master alınamadı: ${e.message}`);
            return DEBUG ? debugStream(steps.join(' | ')) : [];
        }
        if (!/#EXTM3U/.test(masterText)) {
            steps.push('master HLS değil');
            return DEBUG ? debugStream(steps.join(' | ')) : [];
        }
        const quality = detectHlsQuality(masterText) || qualityFromRelease(config.title) || 'Auto';
        const audio = audioSummary(config.audios);

        return [{
            name: `Dizibal ${quality}`,
            title: audio ? `${mediaTitle}\n${audio}` : mediaTitle,
            url: playbackUrl(config.stream, subtitles),
            quality,
            provider: 'dizibal',
            type: 'm3u8',
            headers,
            subtitles
        }];
    } catch (e) {
        return DEBUG ? debugStream(`HATA: ${e.message} | ${steps.join(' | ')}`) : [];
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
