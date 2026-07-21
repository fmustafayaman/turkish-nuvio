import { withTimeout, timeoutSignal, DEFAULT_TIMEOUT_MS } from './http.js';
import { createTtlCache } from './cache.js';

// tmdbId+type başına 30 dk cache — Nuvio runtime uzun ömürlü olduğundan
// bölüm/sezon geçişlerinde aynı TMDB çağrısını tekrar tekrar yapmayı önler,
// hem hızlandırır hem paylaşılan API anahtarındaki throttle riskini azaltır.
const tmdbInfoCache = createTtlCache(30 * 60 * 1000, 300);

// Nuvio plugin runtime'ı TMDB anahtarını provider'a enjekte ETMEZ; provider'lar
// kendi anahtarını taşımak zorunda. Topluluk genelinde paylaşılan public TMDB
// anahtarını kullanıyoruz (kişisel anahtar değil). Kullanıcı isterse provider
// ayarlarından kendi anahtarını girebilir (globalThis.SCRAPER_SETTINGS.tmdbApiKey);
// girilirse o öncelikli kullanılır. Eğer runtime globalThis.TMDB_API_KEY sağlıyorsa
// (kullanıcı ayarı yoksa) onu tercih ederiz.
const DEFAULT_TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

export function getTmdbApiKey() {
    try {
        const settings = typeof globalThis !== 'undefined' ? globalThis.SCRAPER_SETTINGS : null;
        const userKey = settings?.tmdbApiKey ? String(settings.tmdbApiKey).trim() : '';
        if (userKey) return userKey;
    } catch {
        // ignore
    }
    try {
        const injected = typeof globalThis !== 'undefined' ? globalThis.TMDB_API_KEY : '';
        if (injected) return String(injected).trim();
    } catch {
        // ignore
    }
    return DEFAULT_TMDB_API_KEY;
}

// Nuvio ayar diyaloğu için ortak "kendi TMDB anahtarını gir" alanı. Provider
// bunu onSettings'ten (embedSubs vb. diğer alanlarla birlikte) döndürür;
// manifest'te "hasSettings": true olmalı.
export function tmdbApiKeySettingsLayout() {
    return [
        { type: 'header', label: 'TMDB API Anahtarı (opsiyonel)' },
        {
            type: 'text',
            key: 'tmdbApiKey',
            label: 'Kendi TMDB API anahtarın',
            description: 'Boş bırakırsan paylaşılan varsayılan anahtar kullanılır. Kendi TMDB v3 API anahtarını girersen (themoviedb.org hesabından ücretsiz alınır) bu ekrandaki tüm TMDB istekleri onunla yapılır.',
            defaultValue: ''
        }
    ];
}

export async function fetchJson(url, options = {}) {
    const { timeout = DEFAULT_TIMEOUT_MS, ...rest } = options;
    return await withTimeout((async () => {
        const response = await fetch(url, { signal: timeoutSignal(timeout), ...rest });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${url}`);
        }
        return await response.json();
    })(), timeout, url);
}

export async function getTmdbInfo(tmdbId, mediaType) {
    const empty = { title: '', originalTitle: '', turkishTitle: '', year: '', imdbId: null };
    const apiKey = getTmdbApiKey();
    if (!apiKey) return empty;

    const type = mediaType === 'tv' ? 'tv' : 'movie';
    return await tmdbInfoCache.remember(
        `${type}:${tmdbId}`,
        async () => {
            try {
                const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}&append_to_response=external_ids,translations`;
                const data = await fetchJson(url);

                let turkishTitle = '';
                const translations = data.translations?.translations || [];
                const tr = translations.find(t => t.iso_3166_1 === 'TR' || t.iso_639_1 === 'tr');
                if (tr) {
                    turkishTitle = tr.data?.title || tr.data?.name || '';
                }

                return {
                    title: data.name || data.title || data.original_title || '',
                    originalTitle: data.original_title || data.original_name || '',
                    turkishTitle,
                    year: data.release_date?.slice(0, 4) || data.first_air_date?.slice(0, 4) || '',
                    imdbId: data.external_ids?.imdb_id || data.imdb_id || null
                };
            } catch {
                return empty;
            }
        },
        30 * 60 * 1000,
        // Boş/hatalı sonucu cache'leme ki geçici bir hata kalıcı boş sonuca dönüşmesin.
        v => !!(v && (v.title || v.originalTitle || v.imdbId))
    );
}
