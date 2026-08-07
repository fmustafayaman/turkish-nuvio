import { resolveEpisodeMapping } from './utils.js';
import { findByTmdbId, getEpisodeVideos, getEpisodes, findEpisode } from './episodes.js';
import { extractByEmbedId, parseEmbedIdFromUrl, extractStreams } from './extractor.js';
import { createTtlCache } from '../shared/cache.js';
import { getTmdbInfo, tmdbApiKeySettingsLayout } from '../shared/tmdb.js';

// Bir bölümün episode-videos listesindeki TÜM Tau Video kaynaklarını çözer.
// Tek episode-videos çağrısı + kaynak başına bir tau-video API çağrısı; eski
// best-video redirect + HF mapping + bölüm-listesi zincirinden çok daha az istek.
async function extractEpisodeSources(animeId, season, episode, animeTitle, label) {
    const sources = await getEpisodeVideos(animeId, season, episode);
    const streams = [];
    const seen = new Set();
    for (const src of sources) {
        const embedId = parseEmbedIdFromUrl(src && src.url);
        if (!embedId) continue; // yalnızca tau-video embed'leri (mp4 döner)
        const part = await extractByEmbedId(embedId, animeTitle, label, src.extra);
        for (const st of part) {
            if (!st.url || seen.has(st.url)) continue;
            seen.add(st.url);
            streams.push(st);
        }
    }
    return streams;
}

// Seri düzeyi çözümleme (TMDB başlıkları + animecix eşleşmesi) bölümden bölüme
// değişmez; aynı IP'den tekrar tekrar aranması throttle'ı tetikleyen ana
// upstream yüküydü. tmdbId+type başına 30 dk cache'liyoruz.
const resolveCache = createTtlCache(30 * 60 * 1000, 200);

async function resolveSeries(tmdbId, mediaType) {
    return await resolveCache.remember(`${mediaType}:${tmdbId}`, async () => {
        const { title, originalTitle } = await getTmdbInfo(tmdbId, mediaType);
        if (!title && !originalTitle) return null;

        const match = await findByTmdbId(tmdbId, title, originalTitle, mediaType);
        if (!match) return null;

        return { title, originalTitle, animeId: match.id, animeTitle: match.name || title };
    });
}

async function getStreams(tmdbId, mediaType = 'tv', season = 1, episode = 1) {
    try {
        console.log(`[Animecix v1.3.3] getStreams tmdb=${tmdbId} type=${mediaType} S${season}E${episode}`);

        const resolved = await resolveSeries(tmdbId, mediaType);
        if (!resolved) return [];

        const { animeId, animeTitle } = resolved;

        if (mediaType === 'movie') {
            const movieStreams = await extractEpisodeSources(animeId, 1, 1, animeTitle, 'Film');
            console.log(`[Animecix] film → ${movieStreams.length} stream`);
            return movieStreams;
        }

        const s = season || 1;
        const e = episode || 1;

        // 1) Mutlu yol: episode-videos ile ham bölüm numarasını dene (tek çağrı,
        // çoklu kaynak). Çoğu dizide doğru sonucu zaten bu verir.
        const directStreams = await extractEpisodeSources(animeId, s, e, animeTitle, `Bölüm ${e}`);
        if (directStreams.length) {
            console.log(`[Animecix] episode-videos S${s}E${e} → ${directStreams.length} stream`);
            return directStreams;
        }

        // 2) Fallback: MAL bölüm eşlemesi (TMDB↔MAL numaralandırması farklıysa).
        // Riskli üçüncü-parti servise dokunur, yalnızca mutlu yol boşsa çalışır.
        console.log('[Animecix] episode-videos boş, mapping deneniyor');
        let mappedEpisode = null;
        try {
            // getTmdbInfo cache'li (shared/tmdb.js); adım 1'deki resolveSeries
            // çağrısıyla aynı veriyi tekrar upstream'e gitmeden döner.
            const { imdbId } = await getTmdbInfo(tmdbId, mediaType);
            if (imdbId) {
                const mapping = await resolveEpisodeMapping(imdbId, s, e);
                mappedEpisode = mapping?.mal_episode || null;
                if (mappedEpisode && !(mappedEpisode === e && s === 1)) {
                    // MAL numarası mutlaktır; animecix uzun serileri tek sezonda mutlak
                    // numarayla tutar (ör. One Piece S22E15 → S1E1100). Önce TMDB
                    // sezonuyla, boşsa season=1 ile dene.
                    for (const trySeason of [...new Set([s, 1])]) {
                        const mappedStreams = await extractEpisodeSources(animeId, trySeason, mappedEpisode, animeTitle, `Bölüm ${e}`);
                        if (mappedStreams.length) {
                            console.log(`[Animecix] episode-videos (mapped S${trySeason}E${mappedEpisode}) → ${mappedStreams.length} stream`);
                            return mappedStreams;
                        }
                    }
                }
            }
        } catch (mapErr) {
            console.error('[Animecix] mapping hatası (yok sayılıyor):', mapErr?.message || mapErr);
        }

        // 3) Yedek: tam bölüm listesinden ara (nadir edge case'ler)
        console.log('[Animecix] mapping de boş, bölüm listesi deneniyor');
        const episodes = await getEpisodes(animeId, s);
        if (!episodes.length) return [];

        const target = findEpisode(episodes, s, e, mappedEpisode || e);
        if (!target?.url) return [];

        const episodeLabel = target.name || `Bölüm ${target.episodeNum || e}`;
        return await extractStreams(target.url, animeTitle, episodeLabel);
    } catch (err) {
        console.error('[Animecix] getStreams error:', err?.message || err);
        return [];
    }
}

async function onSettings() {
    return tmdbApiKeySettingsLayout();
}

module.exports = { getStreams, onSettings };
