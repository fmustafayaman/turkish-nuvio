import { decodeBase64 } from '../shared/base64.js';
import { SITE_HEADERS } from './constants.js';
import { withTimeout, timeoutSignal, DEFAULT_TIMEOUT_MS } from '../shared/http.js';

export async function fetchText(url, options = {}) {
    const { timeout = DEFAULT_TIMEOUT_MS } = options;
    return await withTimeout((async () => {
        const response = await fetch(url, {
            headers: { ...SITE_HEADERS, ...(options.headers || {}) },
            signal: timeoutSignal(timeout)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${url}`);
        }
        return await response.text();
    })(), timeout, url);
}

export async function postText(url, referer) {
    return await withTimeout((async () => {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...SITE_HEADERS,
                Referer: referer || '',
                'X-Requested-With': 'XMLHttpRequest'
            },
            signal: timeoutSignal(DEFAULT_TIMEOUT_MS)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${url}`);
        }
        return await response.text();
    })(), DEFAULT_TIMEOUT_MS, url);
}

// application/x-www-form-urlencoded POST (ajax_search vb.)
export async function postForm(url, body, options = {}) {
    const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    const referer = options.referer || '';
    const origin = options.origin || '';
    return await withTimeout((async () => {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...SITE_HEADERS,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                Referer: referer,
                ...(origin ? { Origin: origin } : {})
            },
            body,
            signal: timeoutSignal(timeout)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${url}`);
        }
        return await response.text();
    })(), timeout, url);
}

// scx içindeki linkler ROT13 + base64 ile şifrelenmiş.
export function rot13(input) {
    return String(input).replace(/[a-zA-Z]/g, c => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    });
}

export function decodeScxLink(value) {
    try {
        return decodeBase64(rot13(value));
    } catch {
        return '';
    }
}

// Hermes'te String.prototype.normalize güvenilir değil; Türkçe karakterleri
// elle ASCII'ye katlayarak normalize gereksinimini ortadan kaldırıyoruz.
const TR_ASCII_MAP = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u',
    'â': 'a', 'Â': 'a', 'î': 'i', 'Î': 'i', 'û': 'u', 'Û': 'u'
};

function asciiFold(value) {
    return String(value || '').replace(/[çÇğĞıİöÖşŞüÜâÂîÎûÛ]/g, c => TR_ASCII_MAP[c] || c);
}

export function normalizeTitle(value) {
    return asciiFold(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

export function tokenizeTitle(value) {
    return asciiFold(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
}

// Hedef başlığın tüm kelimeleri adayda geçiyorsa eşleşir.
// Site sıralı isimlendirme kullanabildiği için ("The Matrix 4 Resurrections")
// araya giren sıra numaralarını tolere eder.
function tokenSubsetMatch(candidateTokens, targetTokens) {
    if (targetTokens.length < 2) return false;
    const set = new Set(candidateTokens);
    return targetTokens.every(t => set.has(t));
}

export function titlesMatch(candidate, targets) {
    const c = normalizeTitle(candidate);
    if (!c) return false;
    const candidateTokens = tokenizeTitle(candidate);

    return targets.some(t => {
        const n = normalizeTitle(t);
        if (n.length > 2 && (n === c || c.includes(n) || n.includes(c))) {
            return true;
        }
        return tokenSubsetMatch(candidateTokens, tokenizeTitle(t));
    });
}

export function absoluteUrl(href, base) {
    if (!href) return null;
    if (/^https?:\/\//i.test(href)) return href;
    return `${base.replace(/\/+$/, '')}/${href.replace(/^\/+/, '')}`;
}
