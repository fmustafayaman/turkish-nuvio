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

const TV_TYPES = new Set(['tv', 'series', 'show', 'serie']);

function normalizeMediaType(mediaType) {
    return TV_TYPES.has(String(mediaType || '').toLowerCase()) ? 'tv' : 'movie';
}

// Nuvio, katalog kaynağına göre içerik kimliğini farklı biçimlerde geçirir:
//   - TMDB katalogları: "1399", "tmdb:1399", "tmdb/1399", "1399:1:1"
//   - IMDb tabanlı kataloglar (Cinemeta, Streaming Catalogs): "tt0944947"
//   - bazı istemciler: "tt0944947:1:1"
// Provider'ların /movie ve /tv uç noktaları yalnızca sayısal TMDB ID kabul
// ettiği için kimlik burada tek noktadan normalize edilir.
export function normalizeContentId(value) {
    let id = String(value == null ? '' : value).trim();
    if (!id) return '';
    id = id.replace(/^tmdb\s*[:\/-]\s*/i, '');
    const typed = id.match(/^(movie|tv)\s*[:\/-]\s*(\d+)$/i);
    if (typed) return typed[2];
    return id.split(/[\/:]/)[0].trim();
}

const IMDb_ID_RE = /^tt\d{5,10}$/;

// IMDb → TMDB eşlemesi değişmez; 24 saat cache yeterli.
const imdbMapCache = createTtlCache(24 * 60 * 60 * 1000, 300);

async function findImdbMapping(imdbId, apiKey) {
    return await imdbMapCache.remember(
        `imdb:${imdbId}`,
        async () => {
            try {
                const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${apiKey}&external_source=imdb_id`;
                const data = await fetchJson(url);
                const movie = (data?.movie_results || []).find(r => r && r.id) || null;
                const tv = (data?.tv_results || []).find(r => r && r.id) || null;
                return {
                    movie: movie ? String(movie.id) : null,
                    tv: tv ? String(tv.id) : null
                };
            } catch {
                return { movie: null, tv: null };
            }
        },
        undefined,
        // Bulunamayan eşlemeyi cache'leme; IMDb tarafı geçici olarak hata
        // verirse sonraki istek yeniden denesin.
        v => !!(v && (v.movie || v.tv))
    );
}

// İstenen tür önce denenir; IMDb eşlemesi yalnızca diğer türde varsa ona
// düşülür (ör. uygulama "movie" dese de içerik TMDB'de dizi olarak kayıtlıysa).
async function resolveCandidates(tmdbId, mediaType, apiKey) {
    const raw = normalizeContentId(tmdbId);
    const requestedType = normalizeMediaType(mediaType);
    if (!raw) return [];
    if (/^\d+$/.test(raw)) return [{ id: raw, type: requestedType }];
    if (!IMDb_ID_RE.test(raw)) return [];

    const mapping = await findImdbMapping(raw, apiKey);
    const otherType = requestedType === 'tv' ? 'movie' : 'tv';
    const candidates = [];
    if (mapping[requestedType]) candidates.push({ id: mapping[requestedType], type: requestedType });
    if (mapping[otherType]) candidates.push({ id: mapping[otherType], type: otherType });
    return candidates;
}

// Provider'ların doğrudan kullanabileceği sade çözümleyici: "tt0944947" →
// { id: "1399", type: "tv" }. Sayısal ID'ler olduğu gibi döner.
export async function resolveTmdbId(tmdbId, mediaType) {
    const requestedType = normalizeMediaType(mediaType);
    const raw = normalizeContentId(tmdbId);
    const candidates = await resolveCandidates(raw, requestedType, getTmdbApiKey());
    const best = candidates[0];
    return {
        id: best ? best.id : null,
        type: best ? best.type : requestedType,
        imdbId: IMDb_ID_RE.test(raw) ? raw : null
    };
}

async function fetchTmdbInfo(id, type, apiKey) {
    const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&append_to_response=external_ids,translations`;
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
        year: (data.release_date || data.first_air_date || '').slice(0, 4),
        imdbId: data.external_ids?.imdb_id || data.imdb_id || null,
        // "/abc.jpg" — TMDB görsellerini aynen kullanan siteler (dizibal)
        // için başlıktan bağımsız, kesin eşleştirme sinyali.
        posterPath: data.poster_path || ''
    };
}

export async function getTmdbInfo(tmdbId, mediaType) {
    const requestedType = normalizeMediaType(mediaType);
    const empty = {
        title: '', originalTitle: '', turkishTitle: '', year: '',
        imdbId: null, posterPath: '', tmdbId: null,
        mediaType: requestedType, requestedMediaType: requestedType
    };
    const apiKey = getTmdbApiKey();
    if (!apiKey) return empty;

    const candidates = await resolveCandidates(tmdbId, requestedType, apiKey);
    for (const candidate of candidates) {
        const info = await tmdbInfoCache.remember(
            `${candidate.type}:${candidate.id}`,
            async () => {
                try {
                    return await fetchTmdbInfo(candidate.id, candidate.type, apiKey);
                } catch {
                    return null;
                }
            },
            30 * 60 * 1000,
            // Boş/hatalı sonucu cache'leme ki geçici bir hata kalıcı boş sonuca dönüşmesin.
            v => !!(v && (v.title || v.originalTitle || v.imdbId))
        );
        if (info && (info.title || info.originalTitle || info.imdbId)) {
            return {
                ...info,
                tmdbId: Number(candidate.id) || null,
                mediaType: candidate.type,
                requestedMediaType: requestedType
            };
        }
    }
    return empty;
}
