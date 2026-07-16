import { BASE_URL, API_URL } from './constants.js';
import { fetchJson, slugifyQuery, titlesMatch } from './utils.js';

export async function searchAnime(query) {
    const slug = slugifyQuery(query);
    if (!slug) return [];

    const url = `${BASE_URL}secure/search/${encodeURIComponent(slug)}?type=&limit=20`;
    const data = await fetchJson(url);
    return data.results || [];
}

function resultTitles(result) {
    return [
        result.name,
        result.name_english,
        result.name_romanji,
        result.original_title
    ].filter(Boolean);
}

export async function findByTmdbId(tmdbId, title, originalTitle, mediaType = 'tv') {
    const queries = [...new Set([title, originalTitle].filter(Boolean))];
    const tmdbTitles = [title, originalTitle].filter(Boolean);
    let titleCandidate = null;

    for (const query of queries) {
        const results = await searchAnime(query);

        // En güvenli eşleşme: TMDB ID birebir aynı
        const tmdbMatch = results.find(r => r.tmdb_id && Number(r.tmdb_id) === Number(tmdbId));
        if (tmdbMatch) return tmdbMatch;

        // İkincil: başlık güçlü eşleşmesi (yalnızca TMDB ID yoksa kullanılır).
        // Sonucun kendi tmdb_id'si var ve istenenle çakışıyorsa bu FARKLI bir
        // yapımdır (ör. "Rick and Morty" araması → "Rick and Morty: The Anime",
        // tmdb_id 202282 ≠ 60625) — alt-dize eşleşse bile ele.
        if (!titleCandidate) {
            titleCandidate = results.find(r =>
                !(r.tmdb_id && Number(r.tmdb_id) !== Number(tmdbId)) &&
                titlesMatch(tmdbTitles, resultTitles(r))
            ) || null;
        }
    }

    return titleCandidate;
}

// Tek çağrıda bir bölümün TÜM kaynaklarını döndürür (Tau Video, Sibnet, ...).
// best-video redirect'i + HF mapping + bölüm-listesi fallback'lerinin yerine
// geçer: daha az ardışık istek, doğrudan embed URL'leri.
export async function getEpisodeVideos(animeId, season = 1, episode = 1) {
    const url = `${BASE_URL}secure/episode-videos?titleId=${animeId}&episode=${episode}&season=${season}`;
    try {
        const data = await fetchJson(url);
        if (Array.isArray(data)) return data;
        return data?.videos || data?.data || [];
    } catch {
        return [];
    }
}

export async function getMovieEpisodeUrl(animeId) {
    return `secure/best-video?titleId=${animeId}&episode=1&season=1`;
}

export function getEpisodeVideoUrl(animeId, season, episode) {
    return `secure/best-video?titleId=${animeId}&episode=${episode}&season=${season}`;
}

export async function getSeasonIndices(animeId) {
    try {
        const url = `${API_URL}secure/related-videos?episode=1&season=1&titleId=${animeId}&videoId=637113`;
        const data = await fetchJson(url);
        const videos = data?.videos || [];
        if (!videos.length) return [0];

        const title = videos[0]?.title || {};
        const seasons = title.seasons || [];
        if (seasons.length > 0) {
            return seasons.map((_, index) => index);
        }
    } catch {
        // ignore
    }

    return [0];
}

export async function getEpisodes(animeId, seasonNum = 1) {
    const seasonIndices = await getSeasonIndices(animeId);
    const episodes = [];
    const seen = new Set();

    for (const seasonIndex of seasonIndices) {
        const apiSeason = seasonIndex + 1;
        const url = `${API_URL}secure/related-videos?episode=1&season=${apiSeason}&titleId=${animeId}&videoId=637113`;

        try {
            const data = await fetchJson(url);
            for (const video of data?.videos || []) {
                if (!video?.url || !video?.name) continue;
                if (seen.has(video.name)) continue;
                seen.add(video.name);

                episodes.push({
                    id: video.id,
                    name: video.name,
                    url: video.url,
                    episodeNum: video.episode_num,
                    seasonNum: video.season_num || apiSeason,
                    extra: video.extra || null
                });
            }
        } catch {
            // try next season bucket
        }
    }

    return episodes;
}

export function findEpisode(episodes, season, episode, mappedEpisode) {
    // Bilerek indeks fallback'i yok: numara eşleşmesi yoksa yanlış bölüm
    // oynatmaktansa boş dönmek daha güvenli.
    const candidates = [
        episodes.find(e => e.seasonNum === season && e.episodeNum === episode),
        episodes.find(e => e.episodeNum === mappedEpisode),
        episodes.find(e => e.episodeNum === episode)
    ];

    return candidates.find(Boolean) || null;
}
