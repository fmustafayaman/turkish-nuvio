import { VIDLOP_ORIGIN, SITE_HEADERS } from './constants.js';
import { collectCookies } from './utils.js';
import { timeoutSignal } from '../shared/http.js';

function decodeUnicodeEscapes(value) {
    return String(value || '').replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );
}

// Dean Edwards p.a.c.k.e.r çözücü (vidlop player'ı paketli JS kullanır).
const PACKER_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function baseN(num, radix) {
    if (num === 0) return '0';
    let out = '';
    while (num > 0) {
        out = PACKER_DIGITS[num % radix] + out;
        num = Math.floor(num / radix);
    }
    return out;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unpack(packed) {
    const m = /\}\s*\(\s*'([\s\S]*)',\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\.split\('\|'\)/.exec(packed || '');
    if (!m) return null;

    let payload = m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const radix = parseInt(m[2], 10);
    let count = parseInt(m[3], 10);
    const dict = m[4].split('|');

    while (count-- > 0) {
        if (dict[count]) {
            payload = payload.replace(
                new RegExp('\\b' + escapeRegExp(baseN(count, radix)) + '\\b', 'g'),
                dict[count]
            );
        }
    }
    return payload;
}

function unpackPlayerScript(html) {
    const start = String(html || '').indexOf('eval(function');
    if (start === -1) return '';
    const endToken = ".split('|'),0,{}))";
    const end = html.indexOf(endToken, start);
    const block = end === -1 ? html.slice(start) : html.slice(start, end + endToken.length);
    return unpack(block) || '';
}

function tracksToSubs(tracks) {
    const subs = [];
    for (const track of tracks || []) {
        if (!track || !track.file) continue;
        if (track.kind && track.kind !== 'captions' && track.kind !== 'subtitles') continue;
        const lang = String(track.language || '').trim().toLowerCase();
        const rawLabel = String(track.label || '').trim();
        if (lang === 'und' || /^undefined$/i.test(rawLabel)) continue;
        const url = String(track.file).replace(/\\\//g, '/');
        if (!/^https?:\/\//.test(url)) continue;
        const label = rawLabel || 'Altyazı';
        subs.push({ url, lang: label, language: label, name: label });
    }
    return subs;
}

function parseJwTracks(html) {
    const match = /jwSetup\.tracks\s*=\s*(\[[\s\S]*?\])\s*;/.exec(html || '');
    if (match) {
        try {
            return tracksToSubs(JSON.parse(match[1]));
        } catch {
            // fall through to embedded form
        }
    }

    // Paketli player'da tracks JSON nesnesi "tracks":[...] olarak gömülür.
    const embedded = /"tracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"captions"/.exec(html || '')
        || /"tracks"\s*:\s*(\[[\s\S]*?\}\s*\])/.exec(html || '');
    if (embedded) {
        try {
            return tracksToSubs(JSON.parse(embedded[1]));
        } catch {
            // fall through
        }
    }
    return [];
}

function parseInlineCaptions(html) {
    const subs = [];
    const re = /"kind":"captions","file":"([^"]+)","label":"([^"]+)"/g;
    let match;
    while ((match = re.exec(html || '')) !== null) {
        const url = decodeUnicodeEscapes(match[1]).replace(/\\\//g, '/');
        if (!/^https?:\/\//.test(url)) continue;
        const label = decodeUnicodeEscapes(match[2]).trim();
        if (!label || /^undefined$/i.test(label)) continue;
        subs.push({ url, lang: label, language: label, name: label });
    }
    return subs;
}

function collectSubtitles(html) {
    const unpacked = unpackPlayerScript(html);
    const all = [
        ...parseJwTracks(html),
        ...parseInlineCaptions(html),
        ...parseJwTracks(unpacked),
        ...parseInlineCaptions(unpacked)
    ];
    const seen = new Set();
    return all.filter(sub => {
        if (seen.has(sub.url)) return false;
        seen.add(sub.url);
        return true;
    });
}

function videoIdFromUrl(videoUrl) {
    const match = /vidlop\.com\/video\/([^/?#]+)/i.exec(String(videoUrl || ''));
    return match ? match[1] : '';
}

function langCode(track) {
    const lang = String(track.language || track.lang || '').trim().toLowerCase();
    const label = String(track.label || track.name || '').trim().toLowerCase();
    if (lang.startsWith('tr') || lang === 'tur' || /türk|turk/.test(label)) return 'tr';
    if (lang.startsWith('en') || lang === 'eng' || /english|ingiliz/.test(label)) return 'en';
    return lang.slice(0, 2) || 'und';
}

// vidlop sayfasını çekip yalnızca altyazı track'lerini döndürür (stream POST'u yapmaz).
export async function extractVidlopSubtitles(videoUrl, referer) {
    const videoId = videoIdFromUrl(videoUrl);
    if (!videoId) return [];

    const pageUrl = `${VIDLOP_ORIGIN}/video/${videoId}`;
    const pageHtml = await fetch(pageUrl, {
        headers: {
            ...SITE_HEADERS,
            Referer: referer || `${VIDLOP_ORIGIN}/`
        },
        signal: timeoutSignal()
    }).then(r => (r.ok ? r.text() : ''));

    return collectSubtitles(pageHtml).map(sub => ({
        url: sub.url,
        lang: langCode(sub),
        label: sub.name || sub.label || 'Altyazı',
        language: sub.name || sub.label || 'Altyazı',
        name: sub.name || sub.label || 'Altyazı',
        format: 'vtt'
    }));
}

export async function extractVidlop(videoUrl, referer) {
    const videoId = videoIdFromUrl(videoUrl);
    if (!videoId) return [];

    const pageUrl = `${VIDLOP_ORIGIN}/video/${videoId}`;
    const pageResponse = await fetch(pageUrl, {
        headers: {
            ...SITE_HEADERS,
            Referer: referer || `${VIDLOP_ORIGIN}/`
        },
        signal: timeoutSignal()
    });
    if (!pageResponse.ok) {
        throw new Error(`HTTP ${pageResponse.status} on ${pageUrl}`);
    }

    const pageHtml = await pageResponse.text();
    const cookie = collectCookies(pageResponse);

    const body = `hash=${encodeURIComponent(videoId)}&r=${encodeURIComponent(referer || pageUrl)}`;
    const apiResponse = await fetch(
        `${VIDLOP_ORIGIN}/player/index.php?data=${encodeURIComponent(videoId)}&do=getVideo`,
        {
            method: 'POST',
            headers: {
                ...SITE_HEADERS,
                Referer: pageUrl,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(cookie ? { Cookie: cookie } : {})
            },
            body,
            signal: timeoutSignal()
        }
    );

    if (!apiResponse.ok) {
        throw new Error(`HTTP ${apiResponse.status} on vidlop getVideo`);
    }

    let data;
    try {
        data = await apiResponse.json();
    } catch {
        return [];
    }

    const streamUrl = data.securedLink || data.videoSource || '';
    if (!streamUrl || !/^https?:\/\//.test(streamUrl)) return [];

    return [{
        url: streamUrl.replace(/\\\//g, '/'),
        host: 'Vidlop',
        type: 'm3u8',
        headers: {
            Referer: pageUrl,
            Origin: VIDLOP_ORIGIN
        },
        subtitles: collectSubtitles(pageHtml)
    }];
}
