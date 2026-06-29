/**
 * dizibal - Built from src/dizibal/
 * Generated: 2026-06-29T12:12:07.442Z
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
function fetchJson(_0) {
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
    var _a, _b, _c, _d, _e, _f;
    const empty = { title: "", originalTitle: "", turkishTitle: "", year: "", imdbId: null };
    const apiKey = getTmdbApiKey();
    if (!apiKey)
      return empty;
    try {
      const type = mediaType === "tv" ? "tv" : "movie";
      const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}&append_to_response=external_ids,translations`;
      const data = yield fetchJson(url);
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
  });
}

// src/dizibal/index.js
var BASE_URL = "https://dizibal.com";
var HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  "Referer": `${BASE_URL}/`
};
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
function normalizeMediaType(mediaType) {
  const value = String(mediaType || "").toLowerCase();
  return value === "tv" || value === "series" || value === "show" ? "tv" : "movie";
}
function normalizeTitle(value) {
  return String(value || "").replace(/[çÇğĞıİöÖşŞüÜâÂîÎûÛ]/g, (c) => TR_ASCII_MAP[c] || c).toLowerCase().replace(/[^a-z0-9]/g, "");
}
function fetchJson2(path) {
  return __async(this, null, function* () {
    return yield withTimeout((() => __async(this, null, function* () {
      const response = yield fetch(`${BASE_URL}${path}`, {
        headers: HEADERS,
        signal: timeoutSignal(DEFAULT_TIMEOUT_MS)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${path}`);
      }
      return yield response.json();
    }))(), DEFAULT_TIMEOUT_MS, path);
  });
}
function apiPath(path, params = {}) {
  const query = Object.keys(params).filter((key) => params[key] !== void 0 && params[key] !== null && params[key] !== "").map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join("&");
  return `${path}${query ? `?${query}` : ""}`;
}
function itemTitle(item, type) {
  if (!item)
    return "";
  if (type === "tv") {
    return item.name_tr || item.name || item.name_en || item.original_name || "";
  }
  return item.title_tr || item.title || item.title_en || item.original_title || "";
}
function itemYear(item, type) {
  const date = type === "tv" ? item.first_air_date : item.release_date;
  return String(date || "").slice(0, 4);
}
function scoreItem(item, tmdbId, targets, year, type) {
  const idMatch = String(item.id || "") === String(tmdbId);
  const title = normalizeTitle(itemTitle(item, type));
  const exactTitle = targets.map(normalizeTitle).filter(Boolean).includes(title);
  const yearMatch = year && itemYear(item, type) === String(year);
  return (idMatch ? 10 : 0) + (exactTitle ? 3 : 0) + (yearMatch ? 1 : 0);
}
function searchContent(tmdbId, type, targets, year) {
  return __async(this, null, function* () {
    const endpoint = type === "tv" ? "/api/series" : "/api/movies";
    const seen = /* @__PURE__ */ new Set();
    const candidates = [];
    for (const query of targets) {
      let data;
      try {
        data = yield fetchJson2(apiPath(endpoint, {
          search: query,
          lang: "tr",
          siteMode: "full"
        }));
      } catch (e) {
        continue;
      }
      for (const item of data.data || []) {
        if (!item || !item._id || seen.has(item._id))
          continue;
        seen.add(item._id);
        const score = scoreItem(item, tmdbId, targets, year, type);
        if (score <= 0)
          continue;
        candidates.push({ item, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.map((candidate) => candidate.item);
  });
}
function fetchStreamConfig(item, type, season, episode) {
  return __async(this, null, function* () {
    if (type === "tv") {
      const seasonNo = season || 1;
      const episodeNo = episode || 1;
      const data2 = yield fetchJson2(apiPath(
        `/api/series/${item._id}/seasons/${seasonNo}/episodes/${episodeNo}/stream`,
        { lang: "tr", siteMode: "full" }
      ));
      return data2.data || null;
    }
    const data = yield fetchJson2(apiPath(`/api/movies/${item._id}/stream`, {
      lang: "tr",
      siteMode: "full"
    }));
    return data.data || null;
  });
}
function fetchM3u8(src) {
  return __async(this, null, function* () {
    const data = yield fetchJson2(apiPath("/api/stream/m3u8", {
      code: src,
      siteMode: "full"
    }));
    if (!data || data.success === false || !data.m3u8Url)
      return null;
    return {
      url: data.m3u8Url,
      subtitles: Array.isArray(data.subtitles) ? data.subtitles : []
    };
  });
}
function streamHeaders(referer) {
  return {
    "User-Agent": HEADERS["User-Agent"],
    "Referer": referer || BASE_URL
  };
}
function normalizeSubtitle(sub, referer) {
  if (!sub || !sub.url)
    return null;
  const lang = sub.lang || (/turk|türk|tr/i.test(sub.label || sub.url) ? "tr" : "en");
  const label = sub.label || lang.toUpperCase();
  return {
    url: sub.url,
    lang,
    language: lang,
    label,
    name: label,
    format: /\.srt(\?|$)/i.test(sub.url) ? "srt" : "vtt",
    headers: streamHeaders(referer)
  };
}
function resolveTarget(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const type = normalizeMediaType(mediaType);
    const { title, originalTitle, turkishTitle, year } = yield getTmdbInfo(tmdbId, type);
    const targets = [...new Set([turkishTitle, title, originalTitle].filter(Boolean))];
    if (!targets.length)
      return null;
    const candidates = yield searchContent(tmdbId, type, targets, year);
    for (const item of candidates.slice(0, 5)) {
      try {
        const config = yield fetchStreamConfig(item, type, season, episode);
        if (!config || !config.src)
          continue;
        const mediaTitle = type === "tv" ? `${itemTitle(item, type) || title} S${season || 1}E${episode || 1}` : `${itemTitle(item, type) || title}${year ? ` (${year})` : ""}`;
        return { item, config, mediaTitle };
      } catch (e) {
      }
    }
    return null;
  });
}
function getStreams(tmdbId, mediaType = "movie", season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const resolved = yield resolveTarget(tmdbId, mediaType, season, episode);
      if (!resolved)
        return [];
      const extracted = yield fetchM3u8(resolved.config.src);
      if (!extracted || !extracted.url)
        return [];
      const referer = resolved.config.streamUrl || `${BASE_URL}/`;
      const subtitles = extracted.subtitles.map((sub) => normalizeSubtitle(sub, referer)).filter(Boolean);
      return [{
        name: "Dizibal",
        title: resolved.mediaTitle,
        url: extracted.url,
        quality: "Auto",
        provider: "dizibal",
        type: "m3u8",
        headers: streamHeaders(referer),
        subtitles
      }];
    } catch (e) {
      return [];
    }
  });
}
function getSubtitles(tmdbId, mediaType = "movie", season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const streams = yield getStreams(tmdbId, mediaType, season, episode);
      const seen = /* @__PURE__ */ new Set();
      const subtitles = [];
      for (const stream of streams) {
        for (const sub of stream.subtitles || []) {
          if (!sub.url || seen.has(sub.url))
            continue;
          seen.add(sub.url);
          subtitles.push(sub);
        }
      }
      return subtitles;
    } catch (e) {
      return [];
    }
  });
}
module.exports = { getStreams, getSubtitles };
