/**
 * dizibal - Built from src/dizibal/
 * Generated: 2026-07-21T21:21:30.830Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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
      }),
      30 * 60 * 1e3,
      // Boş/hatalı sonucu cache'leme ki geçici bir hata kalıcı boş sonuca dönüşmesin.
      (v) => !!(v && (v.title || v.originalTitle || v.imdbId))
    );
  });
}

// src/shared/hls.js
function utf8ByteLength(str) {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128)
      bytes += 1;
    else if (c < 2048)
      bytes += 2;
    else if (c >= 55296 && c <= 56319) {
      bytes += 4;
      i++;
    } else
      bytes += 3;
  }
  return bytes;
}
function edlQuote(str) {
  const s = String(str || "");
  return `%${utf8ByteLength(s)}%${s}`;
}
function metaSafe(str) {
  return String(str || "").replace(/[;,]/g, " ").trim();
}
function subCodec(sub) {
  const fmt = String(sub.format || "").toLowerCase();
  if (fmt === "srt" || /\.srt(\?|$)/i.test(sub.url || ""))
    return "subrip";
  return "webvtt";
}
function buildMpvEdlUrl(videoUrl, subtitles) {
  const subs = (subtitles || []).filter((s) => s && s.url && /^https?:\/\//i.test(s.url));
  if (!videoUrl || !subs.length)
    return null;
  subs.sort((a, b) => {
    const at = /^tr/i.test(a.lang || a.language || "") ? 0 : 1;
    const bt = /^tr/i.test(b.lang || b.language || "") ? 0 : 1;
    return at - bt;
  });
  let edl = "edl://!no_clip;" + edlQuote(videoUrl);
  for (const sub of subs) {
    const lang = metaSafe(sub.lang || sub.language || "und");
    const title = metaSafe(sub.label || sub.name || lang) || lang;
    edl += ";!new_stream;!no_clip;!delay_open,media_type=sub,codec=" + subCodec(sub) + ";!track_meta,title=" + title + ",lang=" + lang + ";" + edlQuote(sub.url);
  }
  return edl;
}
function detectHlsQuality(masterText) {
  const text = String(masterText || "");
  let maxH = 0;
  const re = /RESOLUTION=(\d+)x(\d+)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    const eq = Math.max(h, Math.round(w * 9 / 16));
    if (eq > maxH)
      maxH = eq;
  }
  if (!maxH)
    return null;
  if (maxH >= 2160)
    return "4K";
  if (maxH >= 1440)
    return "1440p";
  if (maxH >= 1080)
    return "1080p";
  if (maxH >= 720)
    return "720p";
  if (maxH >= 480)
    return "480p";
  return `${maxH}p`;
}
function ensureHlsExtHint(url) {
  const u = String(url || "");
  if (!u || !/^https?:\/\//i.test(u))
    return u;
  if (/\.m3u8(\?|#|$)/i.test(u) || /\.mp4(\?|#|$)/i.test(u) || /\.mkv(\?|#|$)/i.test(u))
    return u;
  return u + (u.indexOf("?") >= 0 ? "&" : "?") + "ext=video.m3u8";
}
function addM3u8Ext(u) {
  const s = String(u || "").trim();
  if (!s || /\.m3u8(\?|#|$)/i.test(s))
    return s;
  const q = s.search(/[?#]/);
  return q >= 0 ? s.slice(0, q) + ".m3u8" + s.slice(q) : s + ".m3u8";
}
function buildSplitStreamEdl(masterText, subtitles) {
  const lines = String(masterText || "").split(/\r?\n/);
  let bestVideo = null, bestBw = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#EXT-X-STREAM-INF.*BANDWIDTH=(\d+)/i);
    if (m) {
      const url = (lines[i + 1] || "").trim();
      if (url && !url.startsWith("#") && Number(m[1]) > bestBw) {
        bestBw = Number(m[1]);
        bestVideo = url;
      }
    }
  }
  if (!bestVideo)
    return null;
  const audios = [];
  for (const l of lines) {
    if (!/^#EXT-X-MEDIA:TYPE=AUDIO/i.test(l))
      continue;
    const uri = (l.match(/URI="([^"]+)"/i) || [])[1];
    if (!uri)
      continue;
    const lang = (l.match(/LANGUAGE="([^"]*)"/i) || [])[1] || "und";
    audios.push({ lang, uri });
  }
  if (!audios.length)
    return null;
  audios.sort((a, b) => (/tr|tur/i.test(a.lang) ? 0 : 1) - (/tr|tur/i.test(b.lang) ? 0 : 1));
  let edl = "edl://!no_clip;" + edlQuote(addM3u8Ext(bestVideo));
  for (const a of audios) {
    const lang = /tr|tur/i.test(a.lang) ? "tr" : /en|eng/i.test(a.lang) ? "en" : metaSafe(a.lang);
    const title = lang === "tr" ? "T\xFCrk\xE7e" : lang === "en" ? "English" : metaSafe(a.lang);
    edl += ";!new_stream;!no_clip;!track_meta,title=" + title + ",lang=" + lang + ";" + edlQuote(addM3u8Ext(a.uri));
  }
  const subs = (subtitles || []).filter((t) => t && t.url && /^https?:\/\//i.test(t.url));
  subs.sort((a, b) => (/^tr/i.test(a.lang || "") ? 0 : 1) - (/^tr/i.test(b.lang || "") ? 0 : 1));
  for (const sub of subs) {
    const lang = metaSafe(sub.lang || sub.language || "und");
    const title = metaSafe(sub.label || sub.name || lang) || lang;
    edl += ";!new_stream;!no_clip;!delay_open,media_type=sub,codec=" + subCodec(sub) + ";!track_meta,title=" + title + ",lang=" + lang + ";" + edlQuote(sub.url);
  }
  return edl;
}
function rewriteMasterChildExt(masterText) {
  return String(masterText || "").split(/\r?\n/).map((line) => {
    if (/^#EXT-X-MEDIA/i.test(line)) {
      return line.replace(/URI="([^"]+)"/i, (_, u) => `URI="${addM3u8Ext(u)}"`);
    }
    if (!line.startsWith("#") && /^https?:\/\//i.test(line.trim())) {
      return addM3u8Ext(line);
    }
    return line;
  }).join("\n");
}
function maybeEmbedSubsUrl(url, subtitles, masterText) {
  let on = false;
  try {
    const s = typeof globalThis !== "undefined" ? globalThis.SCRAPER_SETTINGS : null;
    on = !!(s && s.embedSubs);
  } catch (e) {
    on = false;
  }
  if (!on)
    return ensureHlsExtHint(url);
  const hasExt = /\.m3u8(\?|#|$)/i.test(url);
  const subs = (subtitles || []).filter((t) => t && t.url && /^https?:\/\//i.test(t.url));
  if (hasExt) {
    return subs.length ? buildMpvEdlUrl(url, subs) || url : url;
  }
  if (masterText) {
    const splitEdl = buildSplitStreamEdl(masterText, subtitles);
    if (splitEdl)
      return splitEdl;
    return "memory://" + rewriteMasterChildExt(masterText);
  }
  return ensureHlsExtHint(url);
}
function embedSubsSettingsLayout() {
  return [
    { type: "header", label: "Desktop Altyaz\u0131" },
    {
      type: "toggle",
      key: "embedSubs",
      label: "Masa\xFCst\xFC modu (oynatma + altyaz\u0131 d\xFCzeltmesi)",
      description: "Nuvio Desktop (MPV) i\xE7in: baz\u0131 kaynaklar masa\xFCst\xFCnde oynamaz veya altyaz\u0131 y\xFCklemez. Bunu A\xC7ARSAN stream masa\xFCst\xFC mpv i\xE7in uyarlan\u0131r (oynatma d\xFCzeltmesi + m\xFCmk\xFCn olan yerde g\xF6m\xFCl\xFC altyaz\u0131). SADECE masa\xFCst\xFCnde a\xE7; TV/Android'de kapal\u0131 b\u0131rak.",
      defaultValue: false
    }
  ];
}

// src/dizibal/constants.js
var DOMAIN_CANDIDATES = [
  "https://dizibal.com"
];

// src/dizibal/index.js
var HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
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
function fetchJson2(domain, path) {
  return __async(this, null, function* () {
    return yield withTimeout((() => __async(this, null, function* () {
      const response = yield fetch(`${domain}${path}`, {
        headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": `${domain}/` }),
        signal: timeoutSignal(DEFAULT_TIMEOUT_MS)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${path}`);
      }
      return yield response.json();
    }))(), DEFAULT_TIMEOUT_MS, path);
  });
}
function originOf(url) {
  const match = String(url || "").match(/^(https?:\/\/[^/]+)/i);
  return match ? match[1] : "";
}
function fetchText(url, referer) {
  return __async(this, null, function* () {
    return yield withTimeout((() => __async(this, null, function* () {
      const response = yield fetch(url, {
        headers: {
          "User-Agent": HEADERS["User-Agent"],
          "Accept": "*/*",
          "Accept-Language": HEADERS["Accept-Language"],
          "Referer": referer
        },
        signal: timeoutSignal(DEFAULT_TIMEOUT_MS)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return yield response.text();
    }))(), DEFAULT_TIMEOUT_MS, url);
  });
}
function fetchJsonAt(url, referer, origin) {
  return __async(this, null, function* () {
    return yield withTimeout((() => __async(this, null, function* () {
      const headers = {
        "User-Agent": HEADERS["User-Agent"],
        "Accept": "*/*",
        "Referer": referer
      };
      if (origin)
        headers["Origin"] = origin;
      const response = yield fetch(url, { headers, signal: timeoutSignal(DEFAULT_TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return yield response.json();
    }))(), DEFAULT_TIMEOUT_MS, url);
  });
}
function parseEmbedSubtitles(html) {
  const match = html.match(/["']subtitle["']\s*:\s*"([^"]*)"/i);
  if (!match || !match[1])
    return [];
  return match[1].split(",").map((part) => {
    const m = part.match(/^\s*\[([^\]]*)\]\s*(\S+)\s*$/);
    if (!m)
      return null;
    const label = m[1].trim();
    const url = m[2].trim();
    const key = normalizeTitle(label);
    const lang = /turk|tr/.test(key) ? "tr" : /ing|eng|^en/.test(key) ? "en" : key || "und";
    return { url, label, lang };
  }).filter(Boolean);
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
    for (const domain of DOMAIN_CANDIDATES) {
      const seen = /* @__PURE__ */ new Set();
      const candidates = [];
      for (const query of targets) {
        let data;
        try {
          data = yield fetchJson2(domain, apiPath(endpoint, {
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
          const idMatch = String(item.id || "") === String(tmdbId);
          const iy = itemYear(item, type);
          if (!idMatch && year && iy && Math.abs(Number(iy) - Number(year)) > 1)
            continue;
          const score = scoreItem(item, tmdbId, targets, year, type);
          if (score <= 0)
            continue;
          candidates.push({ item, score });
        }
      }
      if (candidates.length) {
        candidates.sort((a, b) => b.score - a.score);
        return { domain, items: candidates.map((candidate) => candidate.item) };
      }
    }
    return { domain: null, items: [] };
  });
}
function fetchStreamConfig(domain, item, type, season, episode) {
  return __async(this, null, function* () {
    if (type === "tv") {
      const seasonNo = season || 1;
      const episodeNo = episode || 1;
      const data2 = yield fetchJson2(domain, apiPath(
        `/api/series/${item._id}/seasons/${seasonNo}/episodes/${episodeNo}/stream`,
        { lang: "tr", siteMode: "full" }
      ));
      return data2.data || null;
    }
    const data = yield fetchJson2(domain, apiPath(`/api/movies/${item._id}/stream`, {
      lang: "tr",
      siteMode: "full"
    }));
    return data.data || null;
  });
}
function fetchM3u8(domain, config) {
  return __async(this, null, function* () {
    const embedUrl = config && config.streamUrl;
    if (!embedUrl)
      return null;
    const origin = originOf(embedUrl);
    let html;
    try {
      html = yield fetchText(embedUrl, `${domain}/`);
    } catch (e) {
      return null;
    }
    const streamParams = (html.match(/op=get_stream&view_id=\d+&hash=[0-9a-f-]+/i) || [])[0];
    if (!streamParams)
      return null;
    let data;
    try {
      data = yield fetchJsonAt(`${origin}/dl?${streamParams}`, embedUrl, origin);
    } catch (e) {
      return null;
    }
    if (!data || !data.url)
      return null;
    return {
      url: data.url,
      embedOrigin: origin,
      subtitles: parseEmbedSubtitles(html)
    };
  });
}
function streamHeaders(referer) {
  return {
    "User-Agent": HEADERS["User-Agent"],
    "Referer": referer
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
var DEBUG = false;
function debugStream(msg) {
  return [{
    name: `DEBUG: ${msg}`,
    title: "Dizibal te\u015Fhis",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    quality: "debug",
    headers: {},
    provider: "dizibal",
    type: "m3u8"
  }];
}
function resolveTarget(tmdbId, mediaType, season, episode, steps) {
  return __async(this, null, function* () {
    const type = normalizeMediaType(mediaType);
    const { title, originalTitle, turkishTitle, year } = yield getTmdbInfo(tmdbId, type);
    const targets = [...new Set([turkishTitle, title, originalTitle].filter(Boolean))];
    steps == null ? void 0 : steps.push(`tmdb t="${title}" tr="${turkishTitle}" o="${originalTitle}"`);
    if (!targets.length)
      return null;
    const { domain, items } = yield searchContent(tmdbId, type, targets, year);
    steps == null ? void 0 : steps.push(`arama domain=${domain || "yok"} aday=${items.length}`);
    if (!domain)
      return null;
    for (const item of items.slice(0, 5)) {
      try {
        const config = yield fetchStreamConfig(domain, item, type, season, episode);
        if (!config || !config.src)
          continue;
        const mediaTitle = type === "tv" ? `${itemTitle(item, type) || title} S${season || 1}E${episode || 1}` : `${itemTitle(item, type) || title}${year ? ` (${year})` : ""}`;
        return { item, config, mediaTitle, domain };
      } catch (e) {
      }
    }
    steps == null ? void 0 : steps.push("hi\xE7bir aday ge\xE7erli stream config vermedi");
    return null;
  });
}
function getStreams(tmdbId, mediaType = "movie", season = 1, episode = 1) {
  return __async(this, null, function* () {
    const steps = [];
    try {
      console.log(`[Dizibal v1.3.0] getStreams tmdb=${tmdbId} type=${mediaType} S${season}E${episode}`);
      const resolved = yield resolveTarget(tmdbId, mediaType, season, episode, steps);
      if (!resolved)
        return DEBUG ? debugStream(steps.join(" | ")) : [];
      const extracted = yield fetchM3u8(resolved.domain, resolved.config);
      if (!extracted || !extracted.url) {
        steps.push("fetchM3u8 bo\u015F d\xF6nd\xFC");
        return DEBUG ? debugStream(steps.join(" | ")) : [];
      }
      const referer = extracted.embedOrigin ? `${extracted.embedOrigin}/` : `${resolved.domain}/`;
      const subtitles = extracted.subtitles.map((sub) => normalizeSubtitle(sub, referer)).filter(Boolean);
      let masterText = null;
      try {
        masterText = yield fetchText(extracted.url, referer);
      } catch (e) {
        masterText = null;
      }
      const quality = detectHlsQuality(masterText || "") || "Auto";
      const streamUrl = maybeEmbedSubsUrl(extracted.url, subtitles, masterText);
      if (streamUrl !== extracted.url) {
        console.log(`[Dizibal v1.2.5] masa\xFCst\xFC modu: stream d\xF6n\xFC\u015Ft\xFCr\xFCld\xFC (${subtitles.length} altyaz\u0131)`);
      }
      return [{
        name: `Dizibal ${quality}`.trim(),
        title: resolved.mediaTitle,
        url: streamUrl,
        quality,
        provider: "dizibal",
        type: "m3u8",
        headers: streamHeaders(referer),
        subtitles
      }];
    } catch (e) {
      return DEBUG ? debugStream(`HATA: ${e.message} | ${steps.join(" | ")}`) : [];
    }
  });
}
function onSettings() {
  return __async(this, null, function* () {
    return [...embedSubsSettingsLayout(), ...tmdbApiKeySettingsLayout()];
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
module.exports = { getStreams, getSubtitles, onSettings };
