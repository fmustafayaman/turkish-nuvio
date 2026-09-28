/**
 * dizibal - Built from src/dizibal/
 * Generated: 2026-09-28T17:37:08.532Z
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
    const empty = { title: "", originalTitle: "", turkishTitle: "", year: "", imdbId: null, posterPath: "" };
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
            imdbId: ((_f = data.external_ids) == null ? void 0 : _f.imdb_id) || data.imdb_id || null,
            // "/abc.jpg" — TMDB görsellerini aynen kullanan siteler (dizibal)
            // için başlıktan bağımsız, kesin eşleştirme sinyali.
            posterPath: data.poster_path || ""
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
  "https://dizibal.org"
];
var SITE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
};

// src/dizibal/index.js
var VERSION = "1.4.0";
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
function fetchText(url, referer, accept) {
  return __async(this, null, function* () {
    return yield withTimeout((() => __async(this, null, function* () {
      const headers = __spreadValues({}, SITE_HEADERS);
      if (accept)
        headers["Accept"] = accept;
      if (referer)
        headers["Referer"] = referer;
      const response = yield fetch(url, { headers, signal: timeoutSignal(DEFAULT_TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return yield response.text();
    }))(), DEFAULT_TIMEOUT_MS, url);
  });
}
function suggest(domain, query) {
  return __async(this, null, function* () {
    const text = yield fetchText(
      `${domain}/ara/oneri?q=${encodeURIComponent(query)}`,
      `${domain}/`,
      "application/json"
    );
    return JSON.parse(text);
  });
}
function metaYear(meta) {
  const match = String(meta || "").match(/(\d{4})/);
  return match ? match[1] : "";
}
function posterKey(value) {
  const name = String(value || "").split("/").pop() || "";
  return name.replace(/\.[a-z0-9]+$/i, "");
}
function scoreItem(item, targets, year, posterPath) {
  const posterMatch = !!posterPath && posterKey(item.poster) === posterKey(posterPath);
  if (posterMatch)
    return 100;
  const title = normalizeTitle(item.title);
  if (!title || !targets.includes(title))
    return null;
  const itemYear = metaYear(item.meta);
  if (year && itemYear) {
    const diff = Math.abs(Number(itemYear) - Number(year));
    if (diff > 1)
      return null;
    return diff === 0 ? 20 : 15;
  }
  return 10;
}
function searchContent(type, titles, year, posterPath) {
  return __async(this, null, function* () {
    const group = type === "tv" ? "series" : "movies";
    const targets = titles.map(normalizeTitle).filter(Boolean);
    for (const domain of DOMAIN_CANDIDATES) {
      const byUrl = /* @__PURE__ */ new Map();
      let reachable = false;
      for (const query of titles) {
        let data;
        try {
          data = yield suggest(domain, query);
          reachable = true;
        } catch (e) {
          continue;
        }
        for (const item of data && data[group] || []) {
          if (!item || !item.url || byUrl.has(item.url))
            continue;
          const score = scoreItem(item, targets, year, posterPath);
          if (score !== null)
            byUrl.set(item.url, { item, score });
        }
        if ([...byUrl.values()].some((c) => c.score >= 100))
          break;
      }
      if (!reachable)
        continue;
      const items = [...byUrl.values()].sort((a, b) => b.score - a.score).map((c) => c.item);
      return { domain, items };
    }
    return { domain: null, items: [] };
  });
}
function pageUrlFor(item, type, season, episode) {
  const base = String(item.url).replace(/\/+$/, "");
  return type === "tv" ? `${base}/season/${season || 1}/episode/${episode || 1}` : base;
}
function parsePlayerEmbed(html) {
  if (/data-player-type="none"/i.test(html))
    return null;
  const slug = (html.match(/data-pv="([^"]+)"/i) || [])[1];
  const loader = (html.match(/<script[^>]+src="(https?:\/\/[^"]+?)\/(?:assets\/js\/core|e\/c)\.js[^"]*"/i) || [])[1];
  if (!slug || !loader)
    return null;
  return { slug, host: loader.replace(/\/+$/, "") };
}
function parsePlayerConfig(html) {
  const match = html.match(/window\.__PLAYER__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
  if (!match)
    return null;
  try {
    const config = JSON.parse(match[1]);
    return config && config.stream ? config : null;
  } catch (e) {
    return null;
  }
}
function fetchPlayer(domain, pageUrl) {
  return __async(this, null, function* () {
    const html = yield fetchText(pageUrl, `${domain}/`);
    const embed = parsePlayerEmbed(html);
    if (!embed)
      return null;
    const playerUrl = `${embed.host}/assets/js/s.php?s=${encodeURIComponent(embed.slug)}`;
    const playerHtml = yield fetchText(playerUrl, `${domain}/`);
    const config = parsePlayerConfig(playerHtml);
    if (!config)
      return null;
    return { config, host: embed.host };
  });
}
function streamHeaders(host) {
  return {
    "User-Agent": SITE_HEADERS["User-Agent"],
    "Referer": `${host}/`,
    "Origin": host
  };
}
function normalizeSubtitles(subs, host) {
  return (subs || []).map((sub) => {
    if (!sub || !sub.src)
      return null;
    const lang = String(sub.lang || "").toLowerCase() || "und";
    const label = sub.label || lang.toUpperCase();
    return {
      url: sub.src,
      lang,
      language: lang,
      label,
      name: label,
      format: "vtt",
      headers: streamHeaders(host)
    };
  }).filter(Boolean).sort((a, b) => (a.lang === "tr" ? 0 : 1) - (b.lang === "tr" ? 0 : 1));
}
function audioSummary(audios) {
  const labels = (audios || []).filter((a) => a && a.label).map((a) => {
    if (!/^orijinal/i.test(a.label))
      return a.label;
    const lang = String(a.lang || "").toUpperCase();
    return lang && lang !== "TR" ? `Orijinal (${lang})` : "Orijinal";
  });
  return labels.join(" \xB7 ");
}
function qualityFromRelease(name) {
  const match = String(name || "").match(/(2160|1440|1080|720|480)p/i);
  if (!match)
    return null;
  return match[1] === "2160" ? "4K" : `${match[1]}p`;
}
function playbackUrl(url, subtitles) {
  let desktop = false;
  try {
    const s = typeof globalThis !== "undefined" ? globalThis.SCRAPER_SETTINGS : null;
    desktop = !!(s && s.embedSubs);
  } catch (e) {
    desktop = false;
  }
  const hinted = ensureHlsExtHint(url);
  if (!desktop)
    return hinted;
  return buildMpvEdlUrl(hinted, subtitles) || hinted;
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
    const { title, originalTitle, turkishTitle, year, posterPath } = yield getTmdbInfo(tmdbId, type);
    const titles = [...new Set([turkishTitle, title, originalTitle].filter(Boolean))];
    steps == null ? void 0 : steps.push(`tmdb t="${title}" tr="${turkishTitle}" o="${originalTitle}" y=${year}`);
    if (!titles.length)
      return null;
    const { domain, items } = yield searchContent(type, titles, year, posterPath);
    steps == null ? void 0 : steps.push(`arama domain=${domain || "yok"} aday=${items.length}`);
    if (!domain)
      return null;
    for (const item of items.slice(0, 3)) {
      const pageUrl = pageUrlFor(item, type, season, episode);
      try {
        const player = yield fetchPlayer(domain, pageUrl);
        if (!player) {
          steps == null ? void 0 : steps.push(`player yok: ${pageUrl}`);
          continue;
        }
        const name = item.title || title;
        const mediaTitle = type === "tv" ? `${name} S${season || 1}E${episode || 1}` : `${name}${year ? ` (${year})` : ""}`;
        return __spreadProps(__spreadValues({}, player), { mediaTitle });
      } catch (e) {
        steps == null ? void 0 : steps.push(`hata ${pageUrl}: ${e.message}`);
      }
    }
    return null;
  });
}
function getStreams(tmdbId, mediaType = "movie", season = 1, episode = 1) {
  return __async(this, null, function* () {
    const steps = [];
    try {
      console.log(`[Dizibal v${VERSION}] getStreams tmdb=${tmdbId} type=${mediaType} S${season}E${episode}`);
      const resolved = yield resolveTarget(tmdbId, mediaType, season, episode, steps);
      if (!resolved)
        return DEBUG ? debugStream(steps.join(" | ")) : [];
      const { config, host, mediaTitle } = resolved;
      const headers = streamHeaders(host);
      const subtitles = normalizeSubtitles(config.subs, host);
      let masterText = "";
      try {
        masterText = yield fetchText(config.stream, `${host}/`, "*/*");
      } catch (e) {
        steps.push(`master al\u0131namad\u0131: ${e.message}`);
        return DEBUG ? debugStream(steps.join(" | ")) : [];
      }
      if (!/#EXTM3U/.test(masterText)) {
        steps.push("master HLS de\u011Fil");
        return DEBUG ? debugStream(steps.join(" | ")) : [];
      }
      const quality = detectHlsQuality(masterText) || qualityFromRelease(config.title) || "Auto";
      const audio = audioSummary(config.audios);
      return [{
        name: `Dizibal ${quality}`,
        title: audio ? `${mediaTitle}
${audio}` : mediaTitle,
        url: playbackUrl(config.stream, subtitles),
        quality,
        provider: "dizibal",
        type: "m3u8",
        headers,
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
