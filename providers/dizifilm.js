/**
 * dizifilm - Built from src/dizifilm/
 * Generated: 2026-07-21T21:21:30.833Z
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

// src/dizifilm/constants.js
var DOMAIN_CANDIDATES = [
  "https://dizifilmizle.to",
  "https://dizifilm.life"
];
var SITE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
};
var VIDLOP_ORIGIN = "https://vidlop.com";

// src/dizifilm/utils.js
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const _a = options, { timeout = DEFAULT_TIMEOUT_MS } = _a, rest = __objRest(_a, ["timeout"]);
    return yield withTimeout((() => __async(this, null, function* () {
      const response = yield fetch(url, __spreadValues({
        headers: __spreadValues(__spreadValues({}, SITE_HEADERS), rest.headers || {}),
        signal: timeoutSignal(timeout)
      }, rest));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return yield response.text();
    }))(), timeout, url);
  });
}
function fetchJson2(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const _a = options, { timeout = DEFAULT_TIMEOUT_MS } = _a, rest = __objRest(_a, ["timeout"]);
    return yield withTimeout((() => __async(this, null, function* () {
      const response = yield fetch(url, __spreadValues({
        headers: __spreadValues(__spreadValues({}, SITE_HEADERS), rest.headers || {}),
        signal: timeoutSignal(timeout)
      }, rest));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return yield response.json();
    }))(), timeout, url);
  });
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
function asciiFold(value) {
  return String(value || "").replace(/[çÇğĞıİöÖşŞüÜâÂîÎûÛ]/g, (c) => TR_ASCII_MAP[c] || c);
}
function normalizeTitle(value) {
  return asciiFold(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}
function tokenizeTitle(value) {
  return asciiFold(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
}
function tokenSubsetMatch(candidateTokens, targetTokens) {
  if (targetTokens.length < 2)
    return false;
  const set = new Set(candidateTokens);
  return targetTokens.every((t) => set.has(t));
}
function titlesMatch(candidate, targets) {
  const c = normalizeTitle(candidate);
  if (!c)
    return false;
  const candidateTokens = tokenizeTitle(candidate);
  return targets.some((t) => {
    const n = normalizeTitle(t);
    if (n.length > 2 && (n === c || c.includes(n) || n.includes(c))) {
      return true;
    }
    return tokenSubsetMatch(candidateTokens, tokenizeTitle(t));
  });
}
function collectCookies(response) {
  const headers = response && response.headers;
  if (!headers)
    return "";
  if (typeof headers.getSetCookie === "function") {
    const list = headers.getSetCookie();
    if (list && list.length) {
      return list.map((c) => String(c).split(";")[0].trim()).join("; ");
    }
  }
  const raw = headers.get("set-cookie") || headers.get("Set-Cookie");
  if (!raw)
    return "";
  return String(raw).split(";")[0].trim();
}

// src/dizifilm/rsc.js
function unescapeRscChunk(chunk) {
  return String(chunk || "").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "	").replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(
    /\\u([0-9a-fA-F]{4})/g,
    (_, hex) => String.fromCharCode(parseInt(hex, 16))
  );
}
function parseRscPayload(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    chunks.push(unescapeRscChunk(match[1]));
  }
  return chunks.join("");
}
function parseTmdbId(payload) {
  const match = /"tmdb_id":(?:"(\d+)"|(\d+))/.exec(payload || "");
  if (!match)
    return null;
  return match[1] || match[2];
}
function isPlayableEmbed(url) {
  return /^https?:\/\//i.test(url) && /\/(embed|video)\/[^"'\s]+/i.test(url);
}
function parseMovieParts(payload) {
  const match = /"parts":(\[[^\]]*\])/.exec(payload || "");
  if (!match)
    return [];
  try {
    const parts = JSON.parse(match[1]);
    return (parts || []).filter((p) => p && p.url && isPlayableEmbed(String(p.url).replace(/\\\//g, "/"))).map((p) => ({
      title: String(p.title || "Tek Part").trim(),
      url: String(p.url).replace(/\\\//g, "/"),
      language: String(p.language || "T\xFCrk\xE7e").trim(),
      quality: String(p.quality || "HD").trim()
    }));
  } catch (e) {
    const parts = [];
    const re = /"url":"(https?:(?:\\\/|\/)[^"]*?(?:\\\/|\/)(?:embed|video)(?:\\\/|\/)[^"]+)","language":"([^"]*)"/g;
    let m;
    while ((m = re.exec(payload)) !== null) {
      parts.push({
        title: "Tek Part",
        url: m[1].replace(/\\\//g, "/"),
        language: m[2] || "T\xFCrk\xE7e",
        quality: "HD"
      });
    }
    return parts;
  }
}
function parseEpisodeEmbeds(payload, episode) {
  const urls = [];
  const target = episode == null ? null : Number(episode);
  const re = /"episode_number":(\d+)|"embed_player_url_[12]":"(https?:(?:\\\/|\/)[^"]+)"/g;
  let currentEpisode = null;
  let match;
  while ((match = re.exec(payload || "")) !== null) {
    if (match[1] !== void 0) {
      currentEpisode = Number(match[1]);
      continue;
    }
    if (target !== null && currentEpisode !== target)
      continue;
    const url = match[2].replace(/\\\//g, "/");
    if (isPlayableEmbed(url) && !urls.includes(url))
      urls.push(url);
  }
  return urls;
}

// src/dizifilm/vidlop.js
function decodeUnicodeEscapes(value) {
  return String(value || "").replace(
    /\\u([0-9a-fA-F]{4})/g,
    (_, hex) => String.fromCharCode(parseInt(hex, 16))
  );
}
var PACKER_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function baseN(num, radix) {
  if (num === 0)
    return "0";
  let out = "";
  while (num > 0) {
    out = PACKER_DIGITS[num % radix] + out;
    num = Math.floor(num / radix);
  }
  return out;
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function unpack(packed) {
  const m = /\}\s*\(\s*'([\s\S]*)',\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\.split\('\|'\)/.exec(packed || "");
  if (!m)
    return null;
  let payload = m[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  const radix = parseInt(m[2], 10);
  let count = parseInt(m[3], 10);
  const dict = m[4].split("|");
  while (count-- > 0) {
    if (dict[count]) {
      payload = payload.replace(
        new RegExp("\\b" + escapeRegExp(baseN(count, radix)) + "\\b", "g"),
        dict[count]
      );
    }
  }
  return payload;
}
function unpackPlayerScript(html) {
  const start = String(html || "").indexOf("eval(function");
  if (start === -1)
    return "";
  const endToken = ".split('|'),0,{}))";
  const end = html.indexOf(endToken, start);
  const block = end === -1 ? html.slice(start) : html.slice(start, end + endToken.length);
  return unpack(block) || "";
}
function tracksToSubs(tracks) {
  const subs = [];
  for (const track of tracks || []) {
    if (!track || !track.file)
      continue;
    if (track.kind && track.kind !== "captions" && track.kind !== "subtitles")
      continue;
    const lang = String(track.language || "").trim().toLowerCase();
    const rawLabel = String(track.label || "").trim();
    if (lang === "und" || /^undefined$/i.test(rawLabel))
      continue;
    const url = String(track.file).replace(/\\\//g, "/");
    if (!/^https?:\/\//.test(url))
      continue;
    const label = rawLabel || "Altyaz\u0131";
    subs.push({ url, lang: label, language: label, name: label });
  }
  return subs;
}
function parseJwTracks(html) {
  const match = /jwSetup\.tracks\s*=\s*(\[[\s\S]*?\])\s*;/.exec(html || "");
  if (match) {
    try {
      return tracksToSubs(JSON.parse(match[1]));
    } catch (e) {
    }
  }
  const embedded = /"tracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"captions"/.exec(html || "") || /"tracks"\s*:\s*(\[[\s\S]*?\}\s*\])/.exec(html || "");
  if (embedded) {
    try {
      return tracksToSubs(JSON.parse(embedded[1]));
    } catch (e) {
    }
  }
  return [];
}
function parseInlineCaptions(html) {
  const subs = [];
  const re = /"kind":"captions","file":"([^"]+)","label":"([^"]+)"/g;
  let match;
  while ((match = re.exec(html || "")) !== null) {
    const url = decodeUnicodeEscapes(match[1]).replace(/\\\//g, "/");
    if (!/^https?:\/\//.test(url))
      continue;
    const label = decodeUnicodeEscapes(match[2]).trim();
    if (!label || /^undefined$/i.test(label))
      continue;
    subs.push({ url, lang: label, language: label, name: label });
  }
  return subs;
}
function collectSubtitles(html) {
  const unpacked = unpackPlayerScript(html);
  const all = [
    ...parseJwTracks(html),
    ...parseInlineCaptions(html),
    ...parseJwTracks(unpacked),
    ...parseInlineCaptions(unpacked)
  ];
  const seen = /* @__PURE__ */ new Set();
  return all.filter((sub) => {
    if (seen.has(sub.url))
      return false;
    seen.add(sub.url);
    return true;
  });
}
function videoIdFromUrl(videoUrl) {
  const match = /vidlop\.com\/video\/([^/?#]+)/i.exec(String(videoUrl || ""));
  return match ? match[1] : "";
}
function langCode(track) {
  const lang = String(track.language || track.lang || "").trim().toLowerCase();
  const label = String(track.label || track.name || "").trim().toLowerCase();
  if (lang.startsWith("tr") || lang === "tur" || /türk|turk/.test(label))
    return "tr";
  if (lang.startsWith("en") || lang === "eng" || /english|ingiliz/.test(label))
    return "en";
  return lang.slice(0, 2) || "und";
}
function extractVidlopSubtitles(videoUrl, referer) {
  return __async(this, null, function* () {
    const videoId = videoIdFromUrl(videoUrl);
    if (!videoId)
      return [];
    const pageUrl = `${VIDLOP_ORIGIN}/video/${videoId}`;
    const pageHtml = yield fetch(pageUrl, {
      headers: __spreadProps(__spreadValues({}, SITE_HEADERS), {
        Referer: referer || `${VIDLOP_ORIGIN}/`
      }),
      signal: timeoutSignal()
    }).then((r) => r.ok ? r.text() : "");
    return collectSubtitles(pageHtml).map((sub) => ({
      url: sub.url,
      lang: langCode(sub),
      label: sub.name || sub.label || "Altyaz\u0131",
      language: sub.name || sub.label || "Altyaz\u0131",
      name: sub.name || sub.label || "Altyaz\u0131",
      format: "vtt"
    }));
  });
}
function extractVidlop(videoUrl, referer) {
  return __async(this, null, function* () {
    const videoId = videoIdFromUrl(videoUrl);
    if (!videoId)
      return [];
    const pageUrl = `${VIDLOP_ORIGIN}/video/${videoId}`;
    const pageResponse = yield fetch(pageUrl, {
      headers: __spreadProps(__spreadValues({}, SITE_HEADERS), {
        Referer: referer || `${VIDLOP_ORIGIN}/`
      }),
      signal: timeoutSignal()
    });
    if (!pageResponse.ok) {
      throw new Error(`HTTP ${pageResponse.status} on ${pageUrl}`);
    }
    const pageHtml = yield pageResponse.text();
    const cookie = collectCookies(pageResponse);
    const body = `hash=${encodeURIComponent(videoId)}&r=${encodeURIComponent(referer || pageUrl)}`;
    const apiResponse = yield fetch(
      `${VIDLOP_ORIGIN}/player/index.php?data=${encodeURIComponent(videoId)}&do=getVideo`,
      {
        method: "POST",
        headers: __spreadValues(__spreadProps(__spreadValues({}, SITE_HEADERS), {
          Referer: pageUrl,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded"
        }), cookie ? { Cookie: cookie } : {}),
        body,
        signal: timeoutSignal()
      }
    );
    if (!apiResponse.ok) {
      throw new Error(`HTTP ${apiResponse.status} on vidlop getVideo`);
    }
    let data;
    try {
      data = yield apiResponse.json();
    } catch (e) {
      return [];
    }
    const streamUrl = data.securedLink || data.videoSource || "";
    if (!streamUrl || !/^https?:\/\//.test(streamUrl))
      return [];
    return [{
      url: streamUrl.replace(/\\\//g, "/"),
      host: "Vidlop",
      type: "m3u8",
      headers: {
        Referer: pageUrl,
        Origin: VIDLOP_ORIGIN
      },
      subtitles: collectSubtitles(pageHtml)
    }];
  });
}

// src/shared/base64.js
var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function atobPolyfill(input) {
  let str = String(input).replace(/[=]+$/, "");
  if (str.length % 4 === 1)
    return "";
  let output = "";
  for (let bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = CHARS.indexOf(buffer);
  }
  return output;
}
function decodeBase64(input) {
  if (typeof atob === "function") {
    try {
      return atob(input);
    } catch (e) {
      return atobPolyfill(input);
    }
  }
  return atobPolyfill(input);
}
function decodeBase64Bytes(input) {
  const decoded = decodeBase64(input);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
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

// src/dizifilm/bepeak.js
function md5(bytes) {
  function rol(x, c) {
    return x << c | x >>> 32 - c;
  }
  function add(a, b) {
    return a + b & 4294967295;
  }
  const s = [
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21
  ];
  const K = [];
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) & 4294967295;
  }
  const msgLen = bytes.length;
  const bitLen = msgLen * 8;
  let padded = msgLen + 1;
  while (padded % 64 !== 56)
    padded++;
  const buf = new Uint8Array(padded + 8);
  buf.set(bytes);
  buf[msgLen] = 128;
  for (let i = 0; i < 8; i++) {
    buf[padded + i] = bitLen / Math.pow(2, 8 * i) & 255;
  }
  let a0 = 1732584193, b0 = 4023233417, c0 = 2562383102, d0 = 271733878;
  for (let off = 0; off < buf.length; off += 64) {
    const M = [];
    for (let i = 0; i < 16; i++) {
      M[i] = buf[off + i * 4] | buf[off + i * 4 + 1] << 8 | buf[off + i * 4 + 2] << 16 | buf[off + i * 4 + 3] << 24;
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) {
        F = B & C | ~B & D;
        g = i;
      } else if (i < 32) {
        F = D & B | ~D & C;
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = 7 * i % 16;
      }
      F = add(add(add(F, A), K[i]), M[g]);
      A = D;
      D = C;
      C = B;
      B = add(B, rol(F, s[i]));
    }
    a0 = add(a0, A);
    b0 = add(b0, B);
    c0 = add(c0, C);
    d0 = add(d0, D);
  }
  const out = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((v, i) => {
    out[i * 4] = v & 255;
    out[i * 4 + 1] = v >>> 8 & 255;
    out[i * 4 + 2] = v >>> 16 & 255;
    out[i * 4 + 3] = v >>> 24 & 255;
  });
  return out;
}
function evpBytesToKey(passBytes, saltBytes, keyLen, ivLen) {
  const target = keyLen + ivLen;
  let derived = new Uint8Array(0);
  let prev = new Uint8Array(0);
  while (derived.length < target) {
    const input = new Uint8Array(prev.length + passBytes.length + saltBytes.length);
    input.set(prev, 0);
    input.set(passBytes, prev.length);
    input.set(saltBytes, prev.length + passBytes.length);
    prev = md5(input);
    const merged = new Uint8Array(derived.length + prev.length);
    merged.set(derived, 0);
    merged.set(prev, derived.length);
    derived = merged;
  }
  return { key: derived.slice(0, keyLen), iv: derived.slice(keyLen, keyLen + ivLen) };
}
var SBOX = new Uint8Array(256);
var INV_SBOX = new Uint8Array(256);
(function initSbox() {
  let p = 1, q = 1;
  do {
    p = p ^ p << 1 ^ (p & 128 ? 283 : 0);
    p &= 255;
    q ^= q << 1;
    q ^= q << 2;
    q ^= q << 4;
    q &= 255;
    if (q & 128)
      q ^= 9;
    const xformed = q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4);
    SBOX[p] = (xformed ^ 99) & 255;
  } while (p !== 1);
  SBOX[0] = 99;
  for (let i = 0; i < 256; i++)
    INV_SBOX[SBOX[i]] = i;
  function rotl8(x, shift) {
    return (x << shift | x >>> 8 - shift) & 255;
  }
})();
function mul(a, b) {
  let r = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1)
      r ^= a;
    const hi = a & 128;
    a = a << 1 & 255;
    if (hi)
      a ^= 27;
    b >>= 1;
  }
  return r & 255;
}
function expandKey(key) {
  const Nk = 8, Nr = 14, Nb = 4;
  const w = new Array(Nb * (Nr + 1));
  for (let i = 0; i < Nk; i++) {
    w[i] = [key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]];
  }
  const rcon = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54, 108, 216, 171, 77];
  for (let i = Nk; i < Nb * (Nr + 1); i++) {
    let temp = w[i - 1].slice();
    if (i % Nk === 0) {
      temp = [temp[1], temp[2], temp[3], temp[0]].map((b) => SBOX[b]);
      temp[0] ^= rcon[i / Nk - 1];
    } else if (i % Nk === 4) {
      temp = temp.map((b) => SBOX[b]);
    }
    w[i] = w[i - Nk].map((b, j) => b ^ temp[j]);
  }
  return w;
}
function decryptBlock(block, w) {
  const Nr = 14, Nb = 4;
  let state = [];
  for (let i = 0; i < 16; i++)
    state[i] = block[i];
  function addRoundKey(round) {
    for (let c = 0; c < Nb; c++) {
      for (let r = 0; r < 4; r++) {
        state[r + 4 * c] ^= w[round * Nb + c][r];
      }
    }
  }
  function invShiftRows() {
    const t = state.slice();
    for (let r = 1; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        state[r + 4 * ((c + r) % 4)] = t[r + 4 * c];
      }
    }
  }
  function invSubBytes() {
    for (let i = 0; i < 16; i++)
      state[i] = INV_SBOX[state[i]];
  }
  function invMixColumns() {
    for (let c = 0; c < 4; c++) {
      const s0 = state[4 * c], s1 = state[4 * c + 1], s2 = state[4 * c + 2], s3 = state[4 * c + 3];
      state[4 * c] = mul(s0, 14) ^ mul(s1, 11) ^ mul(s2, 13) ^ mul(s3, 9);
      state[4 * c + 1] = mul(s0, 9) ^ mul(s1, 14) ^ mul(s2, 11) ^ mul(s3, 13);
      state[4 * c + 2] = mul(s0, 13) ^ mul(s1, 9) ^ mul(s2, 14) ^ mul(s3, 11);
      state[4 * c + 3] = mul(s0, 11) ^ mul(s1, 13) ^ mul(s2, 9) ^ mul(s3, 14);
    }
  }
  addRoundKey(Nr);
  for (let round = Nr - 1; round >= 1; round--) {
    invShiftRows();
    invSubBytes();
    addRoundKey(round);
    invMixColumns();
  }
  invShiftRows();
  invSubBytes();
  addRoundKey(0);
  return state;
}
function aesCbcDecrypt(key, iv, cipher) {
  const w = expandKey(key);
  const out = new Uint8Array(cipher.length);
  let prev = iv;
  for (let off = 0; off < cipher.length; off += 16) {
    const block = cipher.slice(off, off + 16);
    const dec = decryptBlock(block, w);
    for (let i = 0; i < 16; i++)
      out[off + i] = dec[i] ^ prev[i];
    prev = block;
  }
  const pad = out[out.length - 1];
  if (pad > 0 && pad <= 16)
    return out.slice(0, out.length - pad);
  return out;
}
function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128)
      out.push(c);
    else if (c < 2048) {
      out.push(192 | c >> 6, 128 | c & 63);
    } else {
      out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
    }
  }
  return new Uint8Array(out);
}
function hexBytes(hex) {
  const clean = String(hex || "").replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
function bytesToUtf8(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    if (b < 128) {
      out += String.fromCharCode(b);
      i += 1;
    } else if (b < 224) {
      out += String.fromCharCode((b & 31) << 6 | bytes[i + 1] & 63);
      i += 2;
    } else {
      out += String.fromCharCode((b & 15) << 12 | (bytes[i + 1] & 63) << 6 | bytes[i + 2] & 63);
      i += 3;
    }
  }
  return out;
}
function decryptBePlayer(passphrase, setJson) {
  let parsed;
  try {
    parsed = JSON.parse(setJson);
  } catch (e) {
    return null;
  }
  if (!parsed || !parsed.ct || !parsed.s)
    return null;
  const cipher = decodeBase64Bytes(parsed.ct);
  const salt = hexBytes(parsed.s);
  const pass = utf8Bytes(passphrase);
  const { key, iv } = evpBytesToKey(pass, salt, 32, 16);
  try {
    const plain = aesCbcDecrypt(key, iv, cipher);
    return bytesToUtf8(plain);
  } catch (e) {
    return null;
  }
}
function isBepeakUrl(url) {
  return /\/embed\/[0-9a-f]{16,}/i.test(String(url || ""));
}
function originOf(url) {
  const m = String(url || "").match(/^(https?:\/\/[^/]+)/i);
  return m ? m[1] : "";
}
function fetchEmbedSettings(embedUrl, referer) {
  return __async(this, null, function* () {
    const origin = originOf(embedUrl);
    const response = yield fetch(embedUrl, {
      headers: __spreadProps(__spreadValues({}, SITE_HEADERS), { Referer: referer || `${origin}/` }),
      signal: timeoutSignal()
    });
    if (!response.ok)
      throw new Error(`HTTP ${response.status} on ${embedUrl}`);
    const html = yield response.text();
    const match = /bePlayer\(\s*'([^']+)'\s*,\s*'([\s\S]*?)'\s*\)/.exec(html);
    if (!match)
      return null;
    const decrypted = decryptBePlayer(match[1], match[2]);
    if (!decrypted)
      return null;
    let settings;
    try {
      settings = JSON.parse(decrypted);
    } catch (e) {
      return null;
    }
    return { settings, origin };
  });
}
function mapSubtitles(strSubtitles, origin) {
  return (strSubtitles || []).map((sub) => {
    if (!sub || !sub.file)
      return null;
    let url = String(sub.file).replace(/\\\//g, "/");
    if (/^\//.test(url))
      url = `${origin}${url}`;
    if (!/^https?:\/\//.test(url))
      return null;
    const label = String(sub.label || sub.language || "Altyaz\u0131").trim();
    const raw = String(sub.language || sub.label || "").toLowerCase();
    const lang = /tr|tur|türk|turk/.test(raw) ? "tr" : /en|eng|ing/.test(raw) ? "en" : raw.slice(0, 2) || "und";
    return { url, lang, label, language: label, name: label, format: /\.srt(\?|$)/i.test(url) ? "srt" : "vtt" };
  }).filter(Boolean);
}
function extractBepeak(embedUrl, referer) {
  return __async(this, null, function* () {
    const result = yield fetchEmbedSettings(embedUrl, referer);
    if (!result)
      return [];
    const { settings, origin } = result;
    let streamUrl = String(settings.video_location || "").replace(/\\\//g, "/");
    if (!streamUrl || !/^https?:\/\//.test(streamUrl))
      return [];
    let quality = null;
    let master = null;
    try {
      const resp = yield fetch(streamUrl, {
        headers: __spreadProps(__spreadValues({}, SITE_HEADERS), { Referer: `${origin}/` }),
        signal: timeoutSignal()
      });
      if (resp.ok) {
        master = yield resp.text();
        quality = detectHlsQuality(master);
      }
    } catch (e) {
      quality = null;
    }
    return [{
      url: streamUrl,
      host: "Bepeak",
      type: "m3u8",
      quality,
      master,
      headers: { Referer: `${origin}/`, Origin: origin },
      subtitles: mapSubtitles(settings.strSubtitles, origin)
    }];
  });
}
function extractBepeakSubtitles(embedUrl, referer) {
  return __async(this, null, function* () {
    const result = yield fetchEmbedSettings(embedUrl, referer);
    if (!result)
      return [];
    return mapSubtitles(result.settings.strSubtitles, result.origin);
  });
}

// src/dizifilm/index.js
function extractHost(url, referer) {
  return isBepeakUrl(url) ? extractBepeak(url, referer) : extractVidlop(url, referer);
}
function extractHostSubtitles(url, referer) {
  return isBepeakUrl(url) ? extractBepeakSubtitles(url, referer) : extractVidlopSubtitles(url, referer);
}
function expectedContentType(mediaType) {
  return mediaType === "tv" ? "series" : "movie";
}
function langLabel(language) {
  const value = String(language || "").trim();
  if (!value)
    return "T\xFCrk\xE7e";
  if (/dublaj/i.test(value) && /altyaz/i.test(value))
    return "Dublaj & Altyaz\u0131";
  if (/dublaj/i.test(value))
    return "T\xFCrk\xE7e Dublaj";
  if (/altyaz/i.test(value))
    return "Altyaz\u0131l\u0131";
  return value;
}
var TR_ASCII_MAP2 = {
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
function slugify(value) {
  return String(value || "").replace(/[çÇğĞıİöÖşŞüÜâÂîÎûÛ]/g, (c) => TR_ASCII_MAP2[c] || c).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function buildSlugCandidates(targets) {
  const slugs = /* @__PURE__ */ new Set();
  for (const target of targets) {
    const slug = slugify(target);
    if (slug)
      slugs.add(slug);
  }
  return [...slugs];
}
function searchCandidates(domain, targets, year, contentType) {
  return __async(this, null, function* () {
    const seenSlugs = /* @__PURE__ */ new Set();
    const candidates = [];
    const normTargets = targets.map(normalizeTitle).filter(Boolean);
    for (const query of targets) {
      let data;
      try {
        data = yield fetchJson2(`${domain}/api/search?q=${encodeURIComponent(query)}`);
      } catch (e) {
        continue;
      }
      for (const item of data.results || []) {
        if (!item || !item.slug)
          continue;
        if (item.content_type !== contentType)
          continue;
        if (seenSlugs.has(item.slug))
          continue;
        seenSlugs.add(item.slug);
        const exact = normTargets.includes(normalizeTitle(item.title));
        const loose = titlesMatch(item.title, targets);
        const yearMatch = year && String(item.year || "") === String(year);
        candidates.push({
          slug: item.slug,
          title: item.title,
          year: item.year || "",
          language_type: item.language_type || "",
          score: (exact ? 3 : loose ? 1 : 0) + (yearMatch ? 1 : 0)
        });
      }
    }
    for (const slug of buildSlugCandidates(targets)) {
      if (seenSlugs.has(slug))
        continue;
      seenSlugs.add(slug);
      candidates.unshift({
        slug,
        title: "",
        year: "",
        language_type: "",
        score: 2
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  });
}
function fetchPagePayload(domain, path) {
  return __async(this, null, function* () {
    const html = yield fetchText(`${domain}${path}`);
    return parseRscPayload(html);
  });
}
function resolveMovie(domain, candidate, tmdbId, referer) {
  return __async(this, null, function* () {
    const payload = yield fetchPagePayload(domain, `/film/${candidate.slug}`);
    const pageTmdb = parseTmdbId(payload);
    if (pageTmdb && String(pageTmdb) !== String(tmdbId))
      return null;
    const parts = parseMovieParts(payload);
    if (!parts.length)
      return null;
    return { candidate, parts, referer: `${domain}/film/${candidate.slug}` };
  });
}
function resolveEpisode(domain, candidate, tmdbId, season, episode) {
  return __async(this, null, function* () {
    const path = `/dizi/${candidate.slug}/sezon-${season}/bolum-${episode}`;
    const payload = yield fetchPagePayload(domain, path);
    const pageTmdb = parseTmdbId(payload);
    if (pageTmdb && String(pageTmdb) !== String(tmdbId))
      return null;
    const embeds = parseEpisodeEmbeds(payload, episode);
    if (!embeds.length)
      return null;
    return {
      candidate,
      parts: embeds.map((url, index) => ({
        title: embeds.length > 1 ? `Kaynak ${index + 1}` : "Tek Part",
        url,
        language: candidate.language_type || "T\xFCrk\xE7e",
        quality: "HD"
      })),
      referer: `${domain}${path}`
    };
  });
}
var DEBUG = false;
function debugStream(msg) {
  return [{
    name: `DEBUG: ${msg}`,
    title: "Dizifilm te\u015Fhis",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    quality: "debug",
    headers: {},
    provider: "dizifilm",
    type: "m3u8"
  }];
}
function resolveTarget(tmdbId, mediaType, season, episode, steps) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    const { title, originalTitle, turkishTitle, year } = yield getTmdbInfo(tmdbId, type);
    const targets = [...new Set([turkishTitle, title, originalTitle].filter(Boolean))];
    steps == null ? void 0 : steps.push(`tmdb t="${title}" tr="${turkishTitle}" o="${originalTitle}"`);
    if (!targets.length)
      return null;
    const contentType = expectedContentType(type);
    let resolved = null;
    let totalCandidates = 0;
    for (const domain of DOMAIN_CANDIDATES) {
      const candidates = yield searchCandidates(domain, targets, year, contentType);
      totalCandidates += candidates.length;
      for (const candidate of candidates.slice(0, 5)) {
        try {
          if (type === "tv") {
            resolved = yield resolveEpisode(domain, candidate, tmdbId, season, episode);
          } else {
            resolved = yield resolveMovie(domain, candidate, tmdbId, `${domain}/`);
          }
        } catch (e) {
          resolved = null;
        }
        if (resolved)
          break;
      }
      if (resolved)
        break;
    }
    steps == null ? void 0 : steps.push(`arama aday=${totalCandidates} resolved=${!!resolved}`);
    if (!resolved || !resolved.parts.length)
      return null;
    const suffix = year ? ` (${year})` : "";
    resolved.mediaTitle = type === "tv" ? `${resolved.candidate.title || title} S${season}E${episode}` : `${resolved.candidate.title || title}${suffix}`;
    return resolved;
  });
}
function getStreams(tmdbId, mediaType = "movie", season = 1, episode = 1) {
  return __async(this, null, function* () {
    const steps = [];
    try {
      console.log(`[Dizifilm v1.7.0] getStreams tmdb=${tmdbId} type=${mediaType} S${season}E${episode}`);
      const resolved = yield resolveTarget(tmdbId, mediaType, season, episode, steps);
      if (!resolved)
        return DEBUG ? debugStream(steps.join(" | ")) : [];
      const mediaTitle = resolved.mediaTitle;
      const streams = [];
      const seen = /* @__PURE__ */ new Set();
      for (const part of resolved.parts) {
        let hostStreams = [];
        try {
          hostStreams = yield extractHost(part.url, resolved.referer);
        } catch (e) {
          hostStreams = [];
        }
        for (const stream of hostStreams) {
          if (!stream.url || seen.has(stream.url))
            continue;
          seen.add(stream.url);
          const label = langLabel(part.language);
          const subs = stream.subtitles || [];
          const quality = stream.quality || part.quality || "Auto";
          streams.push({
            name: `Dizifilm ${quality !== "Auto" ? quality + " " : ""}${label} \u2022 ${part.title}`,
            title: mediaTitle,
            url: maybeEmbedSubsUrl(stream.url, subs, stream.master),
            quality,
            headers: stream.headers,
            provider: "dizifilm",
            type: stream.type,
            subtitles: subs
          });
        }
      }
      if (!streams.length) {
        steps.push(`part=${resolved.parts.length} \xE7\u0131kar\u0131ld\u0131 ama stream 0`);
        return DEBUG ? debugStream(steps.join(" | ")) : [];
      }
      return streams;
    } catch (e) {
      return DEBUG ? debugStream(`HATA: ${e.message} | ${steps.join(" | ")}`) : [];
    }
  });
}
function getSubtitles(tmdbId, mediaType = "movie", season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const resolved = yield resolveTarget(tmdbId, mediaType, season, episode);
      if (!resolved)
        return [];
      const subs = [];
      const seen = /* @__PURE__ */ new Set();
      for (const part of resolved.parts) {
        let partSubs = [];
        try {
          partSubs = yield extractHostSubtitles(part.url, resolved.referer);
        } catch (e) {
          partSubs = [];
        }
        for (const sub of partSubs) {
          if (!sub.url || seen.has(sub.url))
            continue;
          seen.add(sub.url);
          subs.push(sub);
        }
      }
      return subs;
    } catch (e) {
      return [];
    }
  });
}
function onSettings() {
  return __async(this, null, function* () {
    return [...embedSubsSettingsLayout(), ...tmdbApiKeySettingsLayout()];
  });
}
module.exports = { getStreams, getSubtitles, onSettings };
