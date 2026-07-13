import { getTmdbInfo, getImdbId, resolveEpisodeMapping } from './utils.js';
import { findByTmdbId, getMovieEpisodeUrl, getEpisodeVideoUrl, getEpisodes, findEpisode } from './episodes.js';
import { extractStreams } from './extractor.js';
import { createTtlCache } from '../shared/cache.js';

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
        console.log(`[Animecix v1.1.0] getStreams tmdb=${tmdbId} type=${mediaType} S${season}E${episode}`);

        const resolved = await resolveSeries(tmdbId, mediaType);
        if (!resolved) return [];

        const { animeId, animeTitle } = resolved;

        if (mediaType === 'movie') {
            const episodePath = await getMovieEpisodeUrl(animeId);
            if (!episodePath) return [];
            return await extractStreams(episodePath, animeTitle, 'Film');
        }

        const s = season || 1;
        const e = episode || 1;

        // 1) Mutlu yol: best-video ile ham bölüm numarasını dene.
        // Yalnızca güvenilir servislere dokunur (TMDB + animecix). Üçüncü-parti
        // mapping servisine (uykuya dalıp fetch'i sonsuza asabilen HF Space)
        // bilerek HİÇ dokunmaz; çoğu dizide doğru sonucu zaten bu verir.
        const directStreams = await extractStreams(
            getEpisodeVideoUrl(animeId, s, e), animeTitle, `Bölüm ${e}`
        );
        if (directStreams.length) {
            console.log(`[Animecix] best-video S${s}E${e} → ${directStreams.length} stream`);
            return directStreams;
        }

        // 2) Son çare: MAL bölüm eşlemesi (TMDB↔MAL numaralandırması farklıysa).
        // Bu adım riskli üçüncü-parti servise dokunur, o yüzden yalnızca mutlu
        // yol başarısız olduğunda çalışır.
        console.log('[Animecix] best-video ham numarada boş, mapping deneniyor');
        try {
            const imdbId = await getImdbId(tmdbId, mediaType);
            if (imdbId) {
                const mapping = await resolveEpisodeMapping(imdbId, s, e);
                const mappedEpisode = mapping?.mal_episode;
                if (mappedEpisode && mappedEpisode !== e) {
                    const mappedStreams = await extractStreams(
                        getEpisodeVideoUrl(animeId, s, mappedEpisode), animeTitle, `Bölüm ${e}`
                    );
                    if (mappedStreams.length) {
                        console.log(`[Animecix] best-video (mapped ${mappedEpisode}) → ${mappedStreams.length} stream`);
                        return mappedStreams;
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

        const target = findEpisode(episodes, s, e, e);
        if (!target?.url) return [];

        const episodeLabel = target.name || `Bölüm ${target.episodeNum || e}`;
        return await extractStreams(target.url, animeTitle, episodeLabel);
    } catch (err) {
        console.error('[Animecix] getStreams error:', err?.message || err);
        return [];
    }
}

module.exports = { getStreams };
