/**
 * animecix - Built from src/animecix/
 * Generated: 2026-06-29T12:12:07.404Z
 */
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/animecix/constants.js
var BASE_URL = "https://animecix.tv/";
var API_URL = "https://mangacix.net/";
var VIDEO_PLAYER = "tau-video.xyz";
var DEFAULT_HEADERS = {
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
var STREAM_HEADERS = {
  "User-Agent": DEFAULT_HEADERS["User-Agent"],
  "Referer": "https://tau-video.xyz/",
  "Origin": "https://tau-video.xyz"
};

// src/shared/http.js
var DEFAULT_TIMEOUT_MS = 15e3;
function timeoutSignal(ms = DEFAULT_TIMEOUT_MS) {
  try {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(ms);
    }
  } catch (e) {
  }
  return void 0;
}
function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS, label = "") {
  if (typeof setTimeout !== "function") {
    return Promise.resolve(promise);
  }
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms${label ? ` (${label})` : ""}`));
    }, ms);
  });
  return Promise.race([promise, timeout]).then(
    (value) => {
      if (timer)
        clearTimeout(timer);
      return value;
    },
    (error) => {
      if (timer)
        clearTimeout(timer);
      throw error;
    }
  );
}

// src/shared/tmdb.js
var DEFAULT_TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
function getTmdbApiKey() {
  try {
    const injected = typeof globalThis !== "undefined" ? globalThis.TMDB_API_KEY : "";
    if (injected)
      return String(injected).trim();
  } catch (e) {
  }
  return DEFAULT_TMDB_API_KEY;
}

// src/animecix/utils.js
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const _a = options, { timeout = DEFAULT_TIMEOUT_MS } = _a, rest = __objRest(_a, ["timeout"]);
    return yield withTimeout((() => __async(this, null, function* () {
      const response = yield fetch(url, __spreadValues({
        headers: __spreadValues(__spreadValues({}, DEFAULT_HEADERS), rest.headers),
        signal: timeoutSignal(timeout)
      }, rest));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return yield response.json();
    }))(), timeout, url);
  });
}
function fetchWithRedirect(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const { timeout = DEFAULT_TIMEOUT_MS } = options;
    return yield withTimeout((() => __async(this, null, function* () {
      const response = yield fetch(url, {
        headers: DEFAULT_HEADERS,
        redirect: "follow",
        signal: timeoutSignal(timeout)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return response.url;
    }))(), timeout, url);
  });
}
function getTmdbInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const apiKey = getTmdbApiKey();
    if (!apiKey)
      return { title: "", originalTitle: "" };
    try {
      const type = mediaType === "tv" ? "tv" : "movie";
      const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}`;
      const data = yield fetchJson(url);
      return {
        title: data.name || data.title || data.original_title || "",
        originalTitle: data.original_title || data.original_name || ""
      };
    } catch (e) {
      return { title: "", originalTitle: "" };
    }
  });
}
function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const apiKey = getTmdbApiKey();
    if (!apiKey)
      return null;
    try {
      const type = mediaType === "tv" ? "tv" : "movie";
      const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${apiKey}`;
      const data = yield fetchJson(url);
      return data.imdb_id || null;
    } catch (e) {
      return null;
    }
  });
}
function resolveEpisodeMapping(imdbId, season, episode) {
  return __async(this, null, function* () {
    try {
      const url = `https://id-mapping-api-malid.hf.space/api/resolve?id=${imdbId}&s=${season}&e=${episode}`;
      const data = yield fetchJson(url, { timeout: 6e3 });
      if (data.error)
        return null;
      return data;
    } catch (e) {
      return null;
    }
  });
}
function slugifyQuery(title) {
  return (title || "").trim().replace(/\s+/g, "-").replace(/[^\w\-]/g, "");
}
var TR_ASCII_MAP = {
  "\xE7": "c",
  "\xC7": "c",
  "\u011F": "g",
  "\u011E": "g",
  "\u0131": "i",
  "\u0130": "i",
  "\xF6": "o",
  "\xD6": "o",
  "\u015F": "s",
  "\u015E": "s",
  "\xFC": "u",
  "\xDC": "u",
  "\xE2": "a",
  "\xC2": "a",
  "\xEE": "i",
  "\xCE": "i",
  "\xFB": "u",
  "\xDB": "u"
};
function normalizeTitle(value) {
  return String(value || "").replace(/[çÇğĞıİöÖşŞüÜâÂîÎûÛ]/g, (c) => TR_ASCII_MAP[c] || c).toLowerCase().replace(/[^a-z0-9]/g, "");
}
function titlesMatch(tmdbTitles, animecixTitles) {
  const left = tmdbTitles.map(normalizeTitle).filter((t) => t.length >= 3);
  const right = animecixTitles.map(normalizeTitle).filter((t) => t.length >= 3);
  for (const a of left) {
    for (const b of right) {
      if (a === b)
        return true;
      if (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))) {
        return true;
      }
    }
  }
  return false;
}
function qualitySortKey(quality) {
  const num = parseInt(String(quality || "").replace(/\D/g, ""), 10);
  return Number.isFinite(num) ? -num : 0;
}
function formatSize(bytes) {
  if (!bytes || !Number.isFinite(bytes))
    return "Unknown";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

// src/animecix/episodes.js
function searchAnime(query) {
  return __async(this, null, function* () {
    const slug = slugifyQuery(query);
    if (!slug)
      return [];
    const url = `${BASE_URL}secure/search/${encodeURIComponent(slug)}?type=&limit=20`;
    const data = yield fetchJson(url);
    return data.results || [];
  });
}
function resultTitles(result) {
  return [
    result.name,
    result.name_english,
    result.name_romanji,
    result.original_title
  ].filter(Boolean);
}
function findByTmdbId(tmdbId, title, originalTitle, mediaType = "tv") {
  return __async(this, null, function* () {
    const queries = [...new Set([title, originalTitle].filter(Boolean))];
    const tmdbTitles = [title, originalTitle].filter(Boolean);
    let titleCandidate = null;
    for (const query of queries) {
      const results = yield searchAnime(query);
      const tmdbMatch = results.find((r) => r.tmdb_id && Number(r.tmdb_id) === Number(tmdbId));
      if (tmdbMatch)
        return tmdbMatch;
      if (!titleCandidate) {
        titleCandidate = results.find((r) => titlesMatch(tmdbTitles, resultTitles(r))) || null;
      }
    }
    return titleCandidate;
  });
}
function getMovieEpisodeUrl(animeId) {
  return __async(this, null, function* () {
    return `secure/best-video?titleId=${animeId}&episode=1&season=1`;
  });
}
function getSeasonIndices(animeId) {
  return __async(this, null, function* () {
    var _a;
    try {
      const url = `${API_URL}secure/related-videos?episode=1&season=1&titleId=${animeId}&videoId=637113`;
      const data = yield fetchJson(url);
      const videos = (data == null ? void 0 : data.videos) || [];
      if (!videos.length)
        return [0];
      const title = ((_a = videos[0]) == null ? void 0 : _a.title) || {};
      const seasons = title.seasons || [];
      if (seasons.length > 0) {
        return seasons.map((_, index) => index);
      }
    } catch (e) {
    }
    return [0];
  });
}
function getEpisodes(animeId, seasonNum = 1) {
  return __async(this, null, function* () {
    const seasonIndices = yield getSeasonIndices(animeId);
    const episodes = [];
    const seen = /* @__PURE__ */ new Set();
    for (const seasonIndex of seasonIndices) {
      const apiSeason = seasonIndex + 1;
      const url = `${API_URL}secure/related-videos?episode=1&season=${apiSeason}&titleId=${animeId}&videoId=637113`;
      try {
        const data = yield fetchJson(url);
        for (const video of (data == null ? void 0 : data.videos) || []) {
          if (!(video == null ? void 0 : video.url) || !(video == null ? void 0 : video.name))
            continue;
          if (seen.has(video.name))
            continue;
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
      } catch (e) {
      }
    }
    return episodes;
  });
}
function findEpisode(episodes, season, episode, mappedEpisode) {
  const candidates = [
    episodes.find((e) => e.seasonNum === season && e.episodeNum === episode),
    episodes.find((e) => e.episodeNum === mappedEpisode),
    episodes.find((e) => e.episodeNum === episode),
    episodes[episode - 1]
  ];
  return candidates.find(Boolean) || null;
}

// src/animecix/extractor.js
function parseEmbedParams(finalUrl) {
  try {
    const str = String(finalUrl || "");
    const queryIndex = str.indexOf("?");
    const pathPart = queryIndex >= 0 ? str.slice(0, queryIndex) : str;
    const queryPart = queryIndex >= 0 ? str.slice(queryIndex + 1) : "";
    let vid = null;
    const vidMatch = /(?:^|&)vid=([^&]*)/.exec(queryPart);
    if (vidMatch)
      vid = decodeURIComponent(vidMatch[1]);
    const pathname = pathPart.replace(/^https?:\/\/[^/]+/i, "");
    const parts = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    let embedId = null;
    if (parts.length >= 2 && parts[0] === "embed") {
      embedId = parts[1];
    } else if (parts.length >= 1) {
      embedId = parts[parts.length - 1];
    }
    return { embedId, vid };
  } catch (e) {
    return { embedId: null, vid: null };
  }
}
function buildEmbedUrl(episodePath) {
  if (episodePath.startsWith("http"))
    return episodePath;
  return `${BASE_URL}${episodePath.replace(/^\/+/, "")}`;
}
function extractStreams(episodePath, animeTitle, episodeLabel) {
  return __async(this, null, function* () {
    const embedUrl = buildEmbedUrl(episodePath);
    const finalUrl = yield fetchWithRedirect(embedUrl);
    const { embedId, vid } = parseEmbedParams(finalUrl);
    if (!embedId || !vid) {
      return [];
    }
    const apiUrl = `https://${VIDEO_PLAYER}/api/video/${embedId}?vid=${vid}`;
    const data = yield fetchJson(apiUrl, {
      headers: {
        Referer: `https://${VIDEO_PLAYER}/`,
        Origin: `https://${VIDEO_PLAYER}`
      }
    });
    const urls = (data == null ? void 0 : data.urls) || [];
    if (!urls.length)
      return [];
    const sorted = [...urls].sort((a, b) => qualitySortKey(a.label) - qualitySortKey(b.label));
    return sorted.map((entry) => ({
      name: `Animecix (${entry.label || "Auto"})`,
      title: `${animeTitle} - ${episodeLabel}`,
      url: entry.url,
      quality: entry.label || "Auto",
      size: formatSize(entry.size),
      headers: STREAM_HEADERS,
      provider: "animecix",
      type: entry.url.includes(".m3u8") ? "m3u8" : "mp4"
    }));
  });
}

// src/animecix/index.js
function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getTmdbInfo(tmdbId, mediaType);
      if (!title && !originalTitle)
        return [];
      const match = yield findByTmdbId(tmdbId, title, originalTitle, mediaType);
      if (!match)
        return [];
      const animeId = match.id;
      const animeTitle = match.name || title;
      if (mediaType === "movie") {
        const episodePath = yield getMovieEpisodeUrl(animeId);
        if (!episodePath)
          return [];
        return yield extractStreams(episodePath, animeTitle, "Film");
      }
      const s = season || 1;
      const e = episode || 1;
      let mappedEpisode = e;
      const imdbId = yield getImdbId(tmdbId, mediaType);
      if (imdbId) {
        const mapping = yield resolveEpisodeMapping(imdbId, s, e);
        if (mapping == null ? void 0 : mapping.mal_episode) {
          mappedEpisode = mapping.mal_episode;
        }
      }
      const episodes = yield getEpisodes(animeId, s);
      if (!episodes.length)
        return [];
      const target = findEpisode(episodes, s, e, mappedEpisode);
      if (!(target == null ? void 0 : target.url))
        return [];
      const episodeLabel = target.name || `B\xF6l\xFCm ${target.episodeNum || e}`;
      return yield extractStreams(target.url, animeTitle, episodeLabel);
    } catch (e) {
      return [];
    }
  });
}
module.exports = { getStreams };
