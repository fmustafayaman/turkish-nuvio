/**
 * fullhdfilm - Built from src/fullhdfilm/
 * Generated: 2026-08-08T18:09:18.744Z
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

// src/fullhdfilm/constants.js
var DOMAIN_CANDIDATES = [
  "https://www.fullhdfilmizlesene.mx",
  "https://fullhdfilmizlesene.mx"
];
var SITE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
};

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

// src/fullhdfilm/utils.js
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const { timeout = DEFAULT_TIMEOUT_MS } = options;
    return yield withTimeout((() => __async(this, null, function* () {
      const response = yield fetch(url, {
        headers: __spreadValues(__spreadValues({}, SITE_HEADERS), options.headers || {}),
        signal: timeoutSignal(timeout)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return yield response.text();
    }))(), timeout, url);
  });
}
function postText(url, referer) {
  return __async(this, null, function* () {
    return yield withTimeout((() => __async(this, null, function* () {
      const response = yield fetch(url, {
        method: "POST",
        headers: __spreadProps(__spreadValues({}, SITE_HEADERS), {
          Referer: referer || "",
          "X-Requested-With": "XMLHttpRequest"
        }),
        signal: timeoutSignal(DEFAULT_TIMEOUT_MS)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return yield response.text();
    }))(), DEFAULT_TIMEOUT_MS, url);
  });
}
function rot13(input) {
  return String(input).replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
  });
}
function decodeScxLink(value) {
  try {
    return decodeBase64(rot13(value));
  } catch (e) {
    return "";
  }
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
function absoluteUrl(href, base) {
  if (!href)
    return null;
  if (/^https?:\/\//i.test(href))
    return href;
  return `${base.replace(/\/+$/, "")}/${href.replace(/^\/+/, "")}`;
}

// src/fullhdfilm/extractors.js
function originOf(url) {
  const m = /^(https?:\/\/[^/]+)/i.exec(String(url || ""));
  return m ? m[1] : "";
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
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function unpack(packed) {
  const m = /\}\s*\(\s*'([\s\S]*)',\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\.split\('\|'\)/.exec(packed);
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
function hexToString(value) {
  const cleaned = String(value).replace(/\\x/g, "").replace(/\\/g, "");
  let out = "";
  for (let i = 0; i + 1 < cleaned.length; i += 2) {
    const code = parseInt(cleaned.substr(i, 2), 16);
    if (Number.isNaN(code))
      return "";
    out += String.fromCharCode(code);
  }
  return out;
}
function rapidDecodeSecret(encoded) {
  const reversed = String(encoded).split("").reverse().join("");
  const t = decodeBase64(reversed);
  const key = "K9L";
  let out = "";
  for (let i = 0; i < t.length; i++) {
    const offset = key.charCodeAt(i % key.length) % 5 + 1;
    out += String.fromCharCode(t.charCodeAt(i) - offset);
  }
  return decodeBase64(out);
}
function parseJwTracks(html) {
  const m = /jwSetup\.tracks\s*=\s*(\[[\s\S]*?\])\s*;/.exec(html);
  if (!m)
    return [];
  let tracks;
  try {
    tracks = JSON.parse(m[1]);
  } catch (e) {
    return [];
  }
  const subs = [];
  for (const t of tracks || []) {
    if (!t || !t.file)
      continue;
    if (t.kind && t.kind !== "captions" && t.kind !== "subtitles")
      continue;
    const url = String(t.file).replace(/\\\//g, "/");
    if (!/^https?:\/\//.test(url))
      continue;
    const label = String(t.label || "Altyaz\u0131").trim();
    subs.push({ url, lang: label, language: label, name: label });
  }
  return subs;
}
function decodeUnicodeEscapes(value) {
  return String(value).replace(
    /\\u([0-9a-fA-F]{4})/g,
    (_, hex) => String.fromCharCode(parseInt(hex, 16))
  );
}
function parseInlineCaptions(html) {
  const subs = [];
  const re = /"kind":"captions","file":"([^"]+)","label":"([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = decodeUnicodeEscapes(m[1]).replace(/\\\//g, "/");
    if (!/^https?:\/\//.test(url))
      continue;
    const label = decodeUnicodeEscapes(m[2]).trim();
    subs.push({ url, lang: label, language: label, name: label });
  }
  return subs;
}
function collectSubtitles(html) {
  const all = [...parseJwTracks(html), ...parseInlineCaptions(html)];
  const seen = /* @__PURE__ */ new Set();
  return all.filter((s) => {
    if (seen.has(s.url))
      return false;
    seen.add(s.url);
    return true;
  });
}
function extractRapidVid(embedUrl, referer) {
  return __async(this, null, function* () {
    const html = yield fetchText(embedUrl, { headers: { Referer: referer } });
    const sources = html.split("jwSetup.sources")[1];
    if (!sources)
      return [];
    const match = /av\('([^']+)'\)/.exec(sources);
    if (!match)
      return [];
    const m3u8 = rapidDecodeSecret(match[1]);
    if (!m3u8 || !/^https?:\/\//.test(m3u8))
      return [];
    return [{
      url: m3u8,
      host: "RapidVid",
      type: "m3u8",
      headers: { Referer: originOf(embedUrl) + "/" },
      subtitles: collectSubtitles(html)
    }];
  });
}
function extractTurkeyPlayer(embedUrl, referer) {
  return __async(this, null, function* () {
    const html = yield fetchText(embedUrl, { headers: { Referer: referer } });
    const jsonMatch = /var\s+video\s*=\s*(\{[\s\S]*?\});/.exec(html);
    if (!jsonMatch)
      return [];
    const raw = jsonMatch[1];
    const uid = /"uid"\s*:\s*"?([^",}]+)"?/.exec(raw);
    const md5 = /"md5"\s*:\s*"([^"]+)"/.exec(raw);
    const id = /"id"\s*:\s*"?([^",}]+)"?/.exec(raw);
    if (!uid || !md5 || !id)
      return [];
    const origin = originOf(embedUrl);
    const master = `${origin}/m3u8/${uid[1]}/${md5[1]}/master.txt?s=1&id=${id[1]}&cache=1`;
    return [{
      url: master,
      host: "TRPlayer",
      type: "m3u8",
      headers: { Referer: origin + "/" }
    }];
  });
}
function extractVidMoxy(embedUrl, referer) {
  return __async(this, null, function* () {
    const html = yield fetchText(embedUrl, { headers: { Referer: referer } });
    const origin = originOf(embedUrl);
    let fileMatch = /"file":\s*"([^"]*\\x[^"]*)"/.exec(html);
    let m3u8 = fileMatch ? hexToString(fileMatch[1]) : "";
    if (!m3u8) {
      const evalMatch = /\};\s*(eval\(function[\s\S]*?)var played = \d+;/.exec(html);
      if (evalMatch) {
        let unpacked = unpack(evalMatch[1]);
        const twice = unpacked ? unpack(unpacked) : null;
        const final = (twice || unpacked || "").replace(/\\\\/g, "\\");
        const fm = /file"\s*:\s*"([^"]*)"/.exec(final);
        if (fm)
          m3u8 = hexToString(fm[1]);
      }
    }
    if (!m3u8 || !/^https?:\/\//.test(m3u8))
      return [];
    return [{
      url: m3u8,
      host: "VidMoxy",
      type: "m3u8",
      headers: { Referer: origin + "/" },
      subtitles: collectSubtitles(html)
    }];
  });
}
function extractSobreatsesuyp(embedUrl, referer) {
  return __async(this, null, function* () {
    const origin = originOf(embedUrl);
    const html = yield fetchText(embedUrl, { headers: { Referer: referer } });
    const m = /"file":"([^"]+)"/.exec(html);
    if (!m)
      return [];
    const file = m[1].replace(/\\\//g, "/");
    const listUrl = `${origin}/${file.replace(/^\/+/, "")}`;
    let list;
    try {
      list = JSON.parse(yield postText(listUrl, `${origin}/`));
    } catch (e) {
      return [];
    }
    if (!Array.isArray(list))
      return [];
    const results = [];
    for (let i = 1; i < list.length; i++) {
      const item = list[i];
      if (!item || !item.file)
        continue;
      const sub = String(item.file).slice(1);
      const playlistUrl = `${origin}/playlist/${sub}.txt`;
      let videoUrl;
      try {
        videoUrl = (yield postText(playlistUrl, `${origin}/`)).trim();
      } catch (e) {
        continue;
      }
      if (!/^https?:\/\//.test(videoUrl))
        continue;
      const label = String(item.title || "").trim();
      results.push({
        url: videoUrl,
        host: label ? `Sobreatsesuyp ${label}` : "Sobreatsesuyp",
        type: "m3u8",
        headers: { Referer: `${origin}/` },
        subtitles: []
      });
    }
    return results;
  });
}
function extractOkRu(embedUrl) {
  return __async(this, null, function* () {
    const idMatch = /(?:ok\.ru|odnoklassniki\.ru)\/(?:videoembed|video|live)\/(\d+)/i.exec(embedUrl) || /[?&]mid=(\d+)/i.exec(embedUrl);
    if (!idMatch)
      return [];
    const mid = idMatch[1];
    let raw;
    try {
      const response = yield fetch("https://www.ok.ru/dk", {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": `https://ok.ru/videoembed/${mid}`,
          "Origin": "https://ok.ru",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: `cmd=videoPlayerMetadata&mid=${mid}`
      });
      if (!response.ok)
        return [];
      raw = yield response.text();
    } catch (e) {
      return [];
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return [];
    }
    if (!data || data.error)
      return [];
    const results = [];
    const push = (url, label) => {
      if (!url || !/^https?:\/\//.test(url))
        return;
      results.push({
        url,
        host: label ? `OK.ru ${label}` : "OK.ru",
        type: /\.m3u8/i.test(url) ? "m3u8" : "mp4",
        headers: { Referer: "https://ok.ru/", "User-Agent": "Mozilla/5.0" },
        subtitles: []
      });
    };
    if (data.hlsManifestUrl)
      push(data.hlsManifestUrl, "HLS");
    if (data.hlsMasterPlaylistUrl)
      push(data.hlsMasterPlaylistUrl, "HLS");
    if (Array.isArray(data.videos)) {
      for (const v of data.videos) {
        if (v && v.url)
          push(v.url, v.name || v.type || "");
      }
    }
    return results;
  });
}
function extractGenericStream(embedUrl, referer, hostName) {
  return __async(this, null, function* () {
    let html;
    try {
      html = yield fetchText(embedUrl, { headers: { Referer: referer } });
    } catch (e) {
      return [];
    }
    const found = /* @__PURE__ */ new Set();
    const patterns = [
      /https?:\/\/[^"'\\\s<>]+?\.m3u8[^"'\\\s<>]*/gi,
      /https?:\/\/[^"'\\\s<>]+?\.mp4[^"'\\\s<>]*/gi,
      /["']file["']\s*[:=]\s*["'](https?:[^"']+)["']/gi,
      /["']src["']\s*[:=]\s*["'](https?:[^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
      /source\s+src=["'](https?:[^"']+)["']/gi
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(html)) !== null) {
        const url = (m[1] || m[0]).replace(/\\u0026/g, "&").replace(/\\\//g, "/");
        if (/^https?:\/\//.test(url) && !/google|facebook|analytics|parklogic/i.test(url)) {
          found.add(url);
        }
      }
    }
    const origin = originOf(embedUrl);
    return [...found].map((url) => ({
      url,
      host: hostName || "Embed",
      type: /\.m3u8/i.test(url) ? "m3u8" : "mp4",
      headers: { Referer: origin ? `${origin}/` : referer },
      subtitles: collectSubtitles(html)
    }));
  });
}
var HOST_REWRITES = [
  [/^(https?:\/\/)(?:www\.)?watch\.trplayer\.site(\/|$)/i, "$1watch.trplayer.com$2"],
  [/^(https?:\/\/)(?:www\.)?trplayer\.site(\/|$)/i, "$1watch.trplayer.com$2"],
  [/^(https?:\/\/)(?:www\.)?trplayer\.org(\/|$)/i, "$1watch.trplayer.com$2"]
];
function rewriteEmbedUrl(url) {
  let out = String(url || "").trim();
  for (const [re, rep] of HOST_REWRITES) {
    out = out.replace(re, rep);
  }
  return out;
}
function extractHost(embedUrl, referer) {
  return __async(this, null, function* () {
    try {
      if (!embedUrl || !/^https?:\/\//i.test(embedUrl))
        return [];
      const url = rewriteEmbedUrl(embedUrl);
      if (/rapidvid|rapid/i.test(url)) {
        return yield extractRapidVid(url, referer);
      }
      if (/trplayer|turkeyplayer|trstx/i.test(url)) {
        return yield extractTurkeyPlayer(url, referer);
      }
      if (/vidmoxy/i.test(url)) {
        return yield extractVidMoxy(url, referer);
      }
      if (/sobreatsesuyp|tovreatmemuyp|sobreat/i.test(url)) {
        return yield extractSobreatsesuyp(url, referer);
      }
      if (/(?:ok\.ru|odnoklassniki)/i.test(url)) {
        const ok = yield extractOkRu(url);
        if (ok.length)
          return ok;
      }
      if (/boosterx|pxplayer|fxplayer|vidmoly|filemoon|dood|streamtape|mixdrop/i.test(url)) {
        const host = (url.match(/^https?:\/\/([^/]+)/i) || [])[1] || "Embed";
        const generic = yield extractGenericStream(url, referer, host.split(".")[0]);
        if (generic.length)
          return generic;
      }
      return yield extractGenericStream(url, referer, "Embed");
    } catch (e) {
      return [];
    }
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

// src/fullhdfilm/index.js
var SCX_KEYS = ["atom", "advid", "advidprox", "proton", "fast", "fastly", "tr", "en"];
function parseSearchResults(html, baseUrl) {
  const results = [];
  const blocks = html.split('<li class="film">').slice(1);
  for (const block of blocks) {
    const href = /<a[^>]*class="tt"[^>]*href="([^"]+)"/.exec(block) || /href="([^"]*\/film\/[^"]+)"/.exec(block);
    const title = /<span class="film-title">([^<]+)<\/span>/.exec(block);
    const original = /<span class="kt">([^<]+)<\/span>/.exec(block);
    const year = /<span class="film-yil">\s*(\d{4})\s*<\/span>/.exec(block);
    if (!href || !title)
      continue;
    const url = absoluteUrl(href[1], baseUrl);
    if (!url)
      continue;
    results.push({
      url,
      title: title[1].trim(),
      original: original ? original[1].trim() : "",
      year: year ? year[1] : ""
    });
  }
  return results;
}
function langLabel(key, subKey) {
  const lang = subKey || key;
  if (lang === "tr" || /dublaj/i.test(lang))
    return "T\xFCrk\xE7e Dublaj";
  if (lang === "en" || /altyaz/i.test(lang))
    return "Altyaz\u0131l\u0131";
  if (lang === "atom")
    return "T\xFCrk\xE7e";
  return "T\xFCrk\xE7e";
}
function parseScx(html) {
  var _a, _b;
  const match = /scx\s*=\s*(\{[\s\S]*?\});/.exec(html);
  if (!match)
    return [];
  let scx;
  try {
    scx = JSON.parse(match[1]);
  } catch (e) {
    return [];
  }
  const entries = [];
  const keys = SCX_KEYS.slice();
  for (const k of Object.keys(scx || {})) {
    if (!keys.includes(k))
      keys.push(k);
  }
  for (const key of keys) {
    const t = (_b = (_a = scx[key]) == null ? void 0 : _a.sx) == null ? void 0 : _b.t;
    if (!t)
      continue;
    if (Array.isArray(t)) {
      for (const enc of t) {
        const url = decodeScxLink(enc);
        if (url && /^https?:\/\//i.test(url)) {
          entries.push({ url, label: langLabel(key) });
        }
      }
    } else if (typeof t === "object") {
      for (const subKey of Object.keys(t)) {
        const url = decodeScxLink(t[subKey]);
        if (url && /^https?:\/\//i.test(url)) {
          entries.push({ url, label: langLabel(key, subKey) });
        }
      }
    }
  }
  if (!entries.length) {
    const re = /(?:data-src|src)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
    let m;
    const seen = /* @__PURE__ */ new Set();
    while ((m = re.exec(html)) !== null) {
      const url = m[1].trim();
      if (seen.has(url))
        continue;
      if (/google|facebook|analytics|gstatic|schema\.org/i.test(url))
        continue;
      if (!/(?:rapidvid|vidmoxy|trplayer|sobreat|ok\.ru|odnoklassniki|boosterx|pxplayer|fxplayer|embed|vod\/)/i.test(url)) {
        continue;
      }
      seen.add(url);
      entries.push({ url, label: "T\xFCrk\xE7e" });
    }
  }
  return entries;
}
var DEBUG = false;
function debugStream(msg) {
  return [{
    name: `DEBUG: ${msg}`,
    title: "FullHDFilm te\u015Fhis",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    quality: "debug",
    headers: {},
    provider: "fullhdfilm",
    type: "m3u8"
  }];
}
function searchOnDomain(domain, targets) {
  return __async(this, null, function* () {
    const candidates = [];
    const seenUrls = /* @__PURE__ */ new Set();
    let totalResults = 0;
    let fetchErr = "";
    const origin = domain.replace(/\/+$/, "");
    for (const query of targets) {
      try {
        const html = yield fetchText(`${origin}/arama/${encodeURIComponent(query)}`);
        const parsed = parseSearchResults(html, origin);
        totalResults += parsed.length;
        for (const r of parsed) {
          if (seenUrls.has(r.url))
            continue;
          if (!titlesMatch(r.title, targets) && !titlesMatch(r.original, targets))
            continue;
          seenUrls.add(r.url);
          const exact = targets.map(normalizeTitle).includes(normalizeTitle(r.title)) || targets.map(normalizeTitle).includes(normalizeTitle(r.original));
          r.score = exact ? 2 : 1;
          candidates.push(r);
        }
      } catch (e) {
        fetchErr = `get:${e.message}`;
      }
      if (!candidates.length) {
        try {
          const html = yield fetchText(`${origin}/arama/?s=${encodeURIComponent(query)}`);
          const parsed = parseSearchResults(html, origin);
          totalResults += parsed.length;
          for (const r of parsed) {
            if (seenUrls.has(r.url))
              continue;
            if (!titlesMatch(r.title, targets) && !titlesMatch(r.original, targets))
              continue;
            seenUrls.add(r.url);
            r.score = 1;
            candidates.push(r);
          }
        } catch (e) {
          fetchErr = fetchErr || `qs:${e.message}`;
        }
      }
    }
    return { candidates, totalResults, fetchErr };
  });
}
function getStreams(tmdbId, mediaType = "movie", season = 1, episode = 1) {
  return __async(this, null, function* () {
    const steps = [];
    try {
      if (mediaType !== "movie") {
        return DEBUG ? debugStream(`mediaType=${mediaType} (sadece movie)`) : [];
      }
      const { title, originalTitle, turkishTitle, year } = yield getTmdbInfo(tmdbId, "movie");
      steps.push(`tmdb t="${title}" tr="${turkishTitle}" o="${originalTitle}"`);
      const targets = [...new Set([turkishTitle, title, originalTitle].filter(Boolean))];
      if (!targets.length) {
        return DEBUG ? debugStream(`TMDB bo\u015F | ${steps.join(" | ")}`) : [];
      }
      const normTargets = targets.map(normalizeTitle).filter(Boolean);
      let baseUrl = null;
      let candidates = [];
      let fetchErr = "";
      let totalResults = 0;
      for (const domain of DOMAIN_CANDIDATES) {
        const found = yield searchOnDomain(domain, targets);
        totalResults += found.totalResults;
        if (found.fetchErr)
          fetchErr = found.fetchErr;
        for (const r of found.candidates) {
          if (year && r.year === String(year))
            r.score = (r.score || 0) + 1;
          if (normTargets.includes(normalizeTitle(r.title)) || normTargets.includes(normalizeTitle(r.original))) {
            r.score = Math.max(r.score || 0, 2);
          }
        }
        if (found.candidates.length) {
          baseUrl = domain.replace(/\/+$/, "");
          candidates = found.candidates;
          break;
        }
      }
      steps.push(`arama sonu\xE7=${totalResults} aday=${candidates.length}${fetchErr ? ` err(${fetchErr})` : ""}`);
      if (!candidates.length) {
        return DEBUG ? debugStream(steps.join(" | ")) : [];
      }
      candidates.sort((a, b) => (b.score || 0) - (a.score || 0));
      const referer = `${baseUrl}/`;
      let match = null;
      let entries = [];
      let scxErr = "";
      for (const candidate of candidates.slice(0, 5)) {
        let pageHtml;
        try {
          pageHtml = yield fetchText(candidate.url);
        } catch (e) {
          scxErr = `sayfa: ${e.message}`;
          continue;
        }
        const parsed = parseScx(pageHtml);
        if (parsed.length) {
          match = candidate;
          entries = parsed;
          break;
        }
      }
      steps.push(`scx entries=${entries.length}${scxErr ? ` ${scxErr}` : ""}`);
      if (!match || !entries.length) {
        return DEBUG ? debugStream(steps.join(" | ")) : [];
      }
      const suffix = year ? ` (${year})` : "";
      const mediaTitle = `${match.title || title}${suffix}`;
      const streams = [];
      const seen = /* @__PURE__ */ new Set();
      let extractErr = "";
      for (const entry of entries) {
        let hostStreams = [];
        try {
          hostStreams = yield extractHost(entry.url, referer);
        } catch (e) {
          extractErr = `${entry.url}: ${e.message}`;
        }
        for (const s of hostStreams) {
          if (!s.url || seen.has(s.url))
            continue;
          seen.add(s.url);
          const subs = s.subtitles || [];
          const playUrl = ensureHlsExtHint(s.url);
          streams.push({
            name: `FullHDFilm ${entry.label} \u2022 ${s.host}`,
            title: mediaTitle,
            url: maybeEmbedSubsUrl(playUrl, subs),
            quality: "Auto",
            headers: s.headers,
            provider: "fullhdfilm",
            type: s.type,
            subtitles: subs
          });
        }
      }
      if (!streams.length && DEBUG) {
        const hosts = entries.map((e) => e.url.replace(/^https?:\/\//, "").split("/")[0]).join(",");
        return debugStream(`${steps.join(" | ")} | extractor 0 | host=${hosts}${extractErr ? ` err(${extractErr})` : ""}`);
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
      const streams = yield getStreams(tmdbId, mediaType, season, episode);
      const subs = [];
      const seen = /* @__PURE__ */ new Set();
      for (const stream of streams) {
        for (const sub of stream.subtitles || []) {
          if (!sub.url || seen.has(sub.url))
            continue;
          seen.add(sub.url);
          const label = sub.name || sub.language || sub.lang || "Altyaz\u0131";
          subs.push({
            url: sub.url,
            lang: sub.lang || sub.language || label,
            label,
            language: sub.language || label,
            name: label,
            format: sub.format || "vtt"
          });
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
