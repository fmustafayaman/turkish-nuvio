/**
 * fullhdfilm - Built from src/fullhdfilm/
 * Generated: 2026-06-29T12:12:07.446Z
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

// src/fullhdfilm/constants.js
var DOMAIN_CANDIDATES = [
  "https://www.fullhdfilmizlesene.life",
  "https://www.fullhdfilmizlesene.de",
  "https://www.fullhdfilmizlesene.nl"
];
var SITE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
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
function extractHost(embedUrl, referer) {
  return __async(this, null, function* () {
    try {
      if (/rapidvid|rapid/i.test(embedUrl)) {
        return yield extractRapidVid(embedUrl, referer);
      }
      if (/trplayer|turkeyplayer/i.test(embedUrl)) {
        return yield extractTurkeyPlayer(embedUrl, referer);
      }
      if (/vidmoxy/i.test(embedUrl)) {
        return yield extractVidMoxy(embedUrl, referer);
      }
      if (/sobreatsesuyp|tovreatmemuyp|sobreat/i.test(embedUrl)) {
        return yield extractSobreatsesuyp(embedUrl, referer);
      }
      return [];
    } catch (e) {
      return [];
    }
  });
}

// src/fullhdfilm/index.js
var SCX_KEYS = ["atom", "advid", "advidprox", "proton", "fast", "fastly", "tr", "en"];
function parseSearchResults(html) {
  const results = [];
  const blocks = html.split('<li class="film">').slice(1);
  for (const block of blocks) {
    const href = /<a[^>]*class="tt"[^>]*href="([^"]+)"/.exec(block);
    const title = /<span class="film-title">([^<]+)<\/span>/.exec(block);
    const original = /<span class="kt">([^<]+)<\/span>/.exec(block);
    const year = /<span class="film-yil">\s*(\d{4})\s*<\/span>/.exec(block);
    if (!href || !title)
      continue;
    results.push({
      url: href[1],
      title: title[1].trim(),
      original: original ? original[1].trim() : "",
      year: year ? year[1] : ""
    });
  }
  return results;
}
function langLabel(key, subKey) {
  const lang = subKey || key;
  if (lang === "tr")
    return "T\xFCrk\xE7e Dublaj";
  if (lang === "en")
    return "Altyaz\u0131l\u0131";
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
  for (const key of SCX_KEYS) {
    const t = (_b = (_a = scx[key]) == null ? void 0 : _a.sx) == null ? void 0 : _b.t;
    if (!t)
      continue;
    if (Array.isArray(t)) {
      for (const enc of t) {
        const url = decodeScxLink(enc);
        if (url)
          entries.push({ url, label: langLabel(key) });
      }
    } else if (typeof t === "object") {
      for (const subKey of Object.keys(t)) {
        const url = decodeScxLink(t[subKey]);
        if (url)
          entries.push({ url, label: langLabel(key, subKey) });
      }
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
        const seenUrls = /* @__PURE__ */ new Set();
        for (const query of targets) {
          let html;
          try {
            html = yield fetchText(`${domain}/arama/${encodeURIComponent(query)}`);
          } catch (e) {
            fetchErr = `${domain}: ${e.message}`;
            continue;
          }
          const parsed = parseSearchResults(html);
          totalResults += parsed.length;
          for (const r of parsed) {
            if (seenUrls.has(r.url))
              continue;
            if (!titlesMatch(r.title, targets) && !titlesMatch(r.original, targets))
              continue;
            seenUrls.add(r.url);
            const exact = normTargets.includes(normalizeTitle(r.title)) || normTargets.includes(normalizeTitle(r.original));
            const yearMatch = year && r.year === String(year);
            r.score = (exact ? 2 : 0) + (yearMatch ? 1 : 0);
            candidates.push(r);
          }
        }
        if (candidates.length) {
          baseUrl = domain;
          break;
        }
      }
      steps.push(`arama sonu\xE7=${totalResults} aday=${candidates.length}${fetchErr ? ` err(${fetchErr})` : ""}`);
      if (!candidates.length) {
        return DEBUG ? debugStream(steps.join(" | ")) : [];
      }
      candidates.sort((a, b) => b.score - a.score);
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
          streams.push({
            name: `FullHDFilm ${entry.label} \u2022 ${s.host}`,
            title: mediaTitle,
            url: s.url,
            quality: "Auto",
            headers: s.headers,
            provider: "fullhdfilm",
            type: s.type,
            subtitles: s.subtitles || []
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
module.exports = { getStreams, getSubtitles };
