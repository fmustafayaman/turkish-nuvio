import { SITE_HEADERS } from './constants.js';
import { withTimeout, timeoutSignal, DEFAULT_TIMEOUT_MS } from '../shared/http.js';

export async function fetchText(url, options = {}) {
    const { timeout = DEFAULT_TIMEOUT_MS, ...rest } = options;
    return await withTimeout((async () => {
        const response = await fetch(url, {
            headers: { ...SITE_HEADERS, ...(rest.headers || {}) },
            signal: timeoutSignal(timeout),
            ...rest
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${url}`);
        }
        return await response.text();
    })(), timeout, url);
}

export async function fetchJson(url, options = {}) {
    const { timeout = DEFAULT_TIMEOUT_MS, ...rest } = options;
    return await withTimeout((async () => {
        const response = await fetch(url, {
            headers: { ...SITE_HEADERS, ...(rest.headers || {}) },
            signal: timeoutSignal(timeout),
            ...rest
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${url}`);
        }
        return await response.json();
    })(), timeout, url);
}

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

export function collectCookies(response) {
    const headers = response && response.headers;
    if (!headers) return '';

    if (typeof headers.getSetCookie === 'function') {
        const list = headers.getSetCookie();
        if (list && list.length) {
            return list.map(c => String(c).split(';')[0].trim()).join('; ');
        }
    }

    const raw = headers.get('set-cookie') || headers.get('Set-Cookie');
    if (!raw) return '';
    return String(raw).split(';')[0].trim();
}
