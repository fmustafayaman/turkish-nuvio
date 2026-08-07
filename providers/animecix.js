/**
 * animecix - Built from src/animecix/
 * Generated: 2026-08-07T22:02:37.660Z
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
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
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
  try {
    if (typeof AbortController === "function" && typeof setTimeout === "function") {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        try {
          controller.abort();
        } catch (e) {
        }
      }, ms);
      if (timer && typeof timer.unref === "function")
        timer.unref();
      return controller.signal;
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
        titleCandidate = results.find(
          (r) => !(r.tmdb_id && Number(r.tmdb_id) !== Number(tmdbId)) && titlesMatch(tmdbTitles, resultTitles(r))
        ) || null;
      }
    }
    return titleCandidate;
  });
}
function getEpisodeVideos(animeId, season = 1, episode = 1) {
  return __async(this, null, function* () {
    const url = `${BASE_URL}secure/episode-videos?titleId=${animeId}&episode=${episode}&season=${season}`;
    try {
      const data = yield fetchJson(url);
      if (Array.isArray(data))
        return data;
      return (data == null ? void 0 : data.videos) || (data == null ? void 0 : data.data) || [];
    } catch (e) {
      return [];
    }
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
    episodes.find((e) => e.episodeNum === episode)
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
function parseEmbedIdFromUrl(url) {
  const m = /tau-video\.xyz\/embed[-/]([A-Za-z0-9]+)/i.exec(String(url || ""));
  return m ? m[1] : null;
}
function extractByEmbedId(embedId, animeTitle, episodeLabel, subName) {
  return __async(this, null, function* () {
    if (!embedId)
      return [];
    const apiUrl = `https://${VIDEO_PLAYER}/api/video/${embedId}`;
    let data;
    try {
      data = yield fetchJson(apiUrl, {
        headers: {
          Referer: `https://${VIDEO_PLAYER}/`,
          Origin: `https://${VIDEO_PLAYER}`
        }
      });
    } catch (e) {
      return [];
    }
    const urls = (data == null ? void 0 : data.urls) || [];
    if (!urls.length)
      return [];
    const sorted = [...urls].sort((a, b) => qualitySortKey(a.label) - qualitySortKey(b.label));
    const suffix = subName ? ` \u2022 ${String(subName).slice(0, 40)}` : "";
    return sorted.map((entry) => ({
      name: `Animecix (${entry.label || "Auto"})${suffix}`,
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

// src/shared/cache.js
function createTtlCache(defaultTtlMs = 30 * 60 * 1e3, maxEntries = 200) {
  const store = /* @__PURE__ */ new Map();
  function get(key) {
    const entry = store.get(key);
    if (!entry)
      return void 0;
    if (entry.expires <= Date.now()) {
      store.delete(key);
      return void 0;
    }
    return entry.value;
  }
  function set(key, value, ttlMs = defaultTtlMs) {
    if (store.size >= maxEntries) {
      const oldest = store.keys().next().value;
      if (oldest !== void 0)
        store.delete(oldest);
    }
    store.set(key, { value, expires: Date.now() + ttlMs });
  }
  function remember(_0, _1) {
    return __async(this, arguments, function* (key, fn, ttlMs = defaultTtlMs, isValid = (v) => v != null) {
      const cached = get(key);
      if (cached !== void 0)
        return cached;
      const value = yield fn();
      if (isValid(value))
        set(key, value, ttlMs);
      return value;
    });
  }
  return { get, set, remember };
}

// src/shared/tmdb.js
var tmdbInfoCache = createTtlCache(30 * 60 * 1e3, 300);
var DEFAULT_TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
function getTmdbApiKey() {
  try {
    const settings = typeof globalThis !== "undefined" ? globalThis.SCRAPER_SETTINGS : null;
    const userKey = (settings == null ? void 0 : settings.tmdbApiKey) ? String(settings.tmdbApiKey).trim() : "";
    if (userKey)
      return userKey;
  } catch (e) {
  }
  try {
    const injected = typeof globalThis !== "undefined" ? globalThis.TMDB_API_KEY : "";
    if (injected)
      return String(injected).trim();
  } catch (e) {
  }
  return DEFAULT_TMDB_API_KEY;
}
function tmdbApiKeySettingsLayout() {
  return [
    { type: "header", label: "TMDB API Anahtar\u0131 (opsiyonel)" },
    {
      type: "text",
      key: "tmdbApiKey",
      label: "Kendi TMDB API anahtar\u0131n",
      description: "Bo\u015F b\u0131rak\u0131rsan payla\u015F\u0131lan varsay\u0131lan anahtar kullan\u0131l\u0131r. Kendi TMDB v3 API anahtar\u0131n\u0131 girersen (themoviedb.org hesab\u0131ndan \xFCcretsiz al\u0131n\u0131r) bu ekrandaki t\xFCm TMDB istekleri onunla yap\u0131l\u0131r.",
      defaultValue: ""
    }
  ];
}
function fetchJson2(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const _a = options, { timeout = DEFAULT_TIMEOUT_MS } = _a, rest = __objRest(_a, ["timeout"]);
    return yield withTimeout((() => __async(this, null, function* () {
      const response = yield fetch(url, __spreadValues({ signal: timeoutSignal(timeout) }, rest));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return yield response.json();
    }))(), timeout, url);
  });
}
function getTmdbInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const empty = { title: "", originalTitle: "", turkishTitle: "", year: "", imdbId: null };
    const apiKey = getTmdbApiKey();
    if (!apiKey)
      return empty;
    const type = mediaType === "tv" ? "tv" : "movie";
    return yield tmdbInfoCache.remember(
      `${type}:${tmdbId}`,
      () => __async(this, null, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
          const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}&append_to_response=external_ids,translations`;
          const data = yield fetchJson2(url);
          let turkishTitle = "";
          const translations = ((_a = data.translations) == null ? void 0 : _a.translations) || [];
          const tr = translations.find((t) => t.iso_3166_1 === "TR" || t.iso_639_1 === "tr");
          if (tr) {
            turkishTitle = ((_b = tr.data) == null ? void 0 : _b.title) || ((_c = tr.data) == null ? void 0 : _c.name) || "";
          }
          return {
            title: data.name || data.title || data.original_title || "",
            originalTitle: data.original_title || data.original_name || "",
            turkishTitle,
            year: ((_d = data.release_date) == null ? void 0 : _d.slice(0, 4)) || ((_e = data.first_air_date) == null ? void 0 : _e.slice(0, 4)) || "",
            imdbId: ((_f = data.external_ids) == null ? void 0 : _f.imdb_id) || data.imdb_id || null
          };
        } catch (e) {
          return empty;
        }
      }),
      30 * 60 * 1e3,
      // Boş/hatalı sonucu cache'leme ki geçici bir hata kalıcı boş sonuca dönüşmesin.
      (v) => !!(v && (v.title || v.originalTitle || v.imdbId))
    );
  });
}

// src/animecix/index.js
function extractEpisodeSources(animeId, season, episode, animeTitle, label) {
  return __async(this, null, function* () {
    const sources = yield getEpisodeVideos(animeId, season, episode);
    const streams = [];
    const seen = /* @__PURE__ */ new Set();
    for (const src of sources) {
      const embedId = parseEmbedIdFromUrl(src && src.url);
      if (!embedId)
        continue;
      const part = yield extractByEmbedId(embedId, animeTitle, label, src.extra);
      for (const st of part) {
        if (!st.url || seen.has(st.url))
          continue;
        seen.add(st.url);
        streams.push(st);
      }
    }
    return streams;
  });
}
var resolveCache = createTtlCache(30 * 60 * 1e3, 200);
function resolveSeries(tmdbId, mediaType) {
  return __async(this, null, function* () {
    return yield resolveCache.remember(`${mediaType}:${tmdbId}`, () => __async(this, null, function* () {
      const { title, originalTitle } = yield getTmdbInfo(tmdbId, mediaType);
      if (!title && !originalTitle)
        return null;
      const match = yield findByTmdbId(tmdbId, title, originalTitle, mediaType);
      if (!match)
        return null;
      return { title, originalTitle, animeId: match.id, animeTitle: match.name || title };
    }));
  });
}
function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      console.log(`[Animecix v1.3.3] getStreams tmdb=${tmdbId} type=${mediaType} S${season}E${episode}`);
      const resolved = yield resolveSeries(tmdbId, mediaType);
      if (!resolved)
        return [];
      const { animeId, animeTitle } = resolved;
      if (mediaType === "movie") {
        const movieStreams = yield extractEpisodeSources(animeId, 1, 1, animeTitle, "Film");
        console.log(`[Animecix] film \u2192 ${movieStreams.length} stream`);
        return movieStreams;
      }
      const s = season || 1;
      const e = episode || 1;
      const directStreams = yield extractEpisodeSources(animeId, s, e, animeTitle, `B\xF6l\xFCm ${e}`);
      if (directStreams.length) {
        console.log(`[Animecix] episode-videos S${s}E${e} \u2192 ${directStreams.length} stream`);
        return directStreams;
      }
      console.log("[Animecix] episode-videos bo\u015F, mapping deneniyor");
      let mappedEpisode = null;
      try {
        const { imdbId } = yield getTmdbInfo(tmdbId, mediaType);
        if (imdbId) {
          const mapping = yield resolveEpisodeMapping(imdbId, s, e);
          mappedEpisode = (mapping == null ? void 0 : mapping.mal_episode) || null;
          if (mappedEpisode && !(mappedEpisode === e && s === 1)) {
            for (const trySeason of [.../* @__PURE__ */ new Set([s, 1])]) {
              const mappedStreams = yield extractEpisodeSources(animeId, trySeason, mappedEpisode, animeTitle, `B\xF6l\xFCm ${e}`);
              if (mappedStreams.length) {
                console.log(`[Animecix] episode-videos (mapped S${trySeason}E${mappedEpisode}) \u2192 ${mappedStreams.length} stream`);
                return mappedStreams;
              }
            }
          }
        }
      } catch (mapErr) {
        console.error("[Animecix] mapping hatas\u0131 (yok say\u0131l\u0131yor):", (mapErr == null ? void 0 : mapErr.message) || mapErr);
      }
      console.log("[Animecix] mapping de bo\u015F, b\xF6l\xFCm listesi deneniyor");
      const episodes = yield getEpisodes(animeId, s);
      if (!episodes.length)
        return [];
      const target = findEpisode(episodes, s, e, mappedEpisode || e);
      if (!(target == null ? void 0 : target.url))
        return [];
      const episodeLabel = target.name || `B\xF6l\xFCm ${target.episodeNum || e}`;
      return yield extractStreams(target.url, animeTitle, episodeLabel);
    } catch (err) {
      console.error("[Animecix] getStreams error:", (err == null ? void 0 : err.message) || err);
      return [];
    }
  });
}
function onSettings() {
  return __async(this, null, function* () {
    return tmdbApiKeySettingsLayout();
  });
}
module.exports = { getStreams, onSettings };
