/**
 * dizifilm - Built from src/dizifilm/
 * Generated: 2026-06-29T12:12:07.444Z
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

// src/dizifilm/constants.js
var DOMAIN_CANDIDATES = [
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
function parseMovieParts(payload) {
  const match = /"parts":(\[[^\]]*\])/.exec(payload || "");
  if (!match)
    return [];
  try {
    const parts = JSON.parse(match[1]);
    return (parts || []).filter((p) => p && p.url && /vidlop\.com\/video\//i.test(p.url)).map((p) => ({
      title: String(p.title || "Tek Part").trim(),
      url: String(p.url).replace(/\\\//g, "/"),
      language: String(p.language || "T\xFCrk\xE7e").trim(),
      quality: String(p.quality || "HD").trim()
    }));
  } catch (e) {
    const parts = [];
    const re = /"url":"(https:\/\/vidlop\.com\/video\/[^"]+)","language":"([^"]*)"/g;
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
function parseEpisodeEmbeds(payload) {
  const urls = [];
  for (const key of ["embed_player_url_1", "embed_player_url_2"]) {
    const match = new RegExp(`"${key}":"(https:\\\\/\\\\/vidlop\\.com\\\\/video\\\\/[^"]+)"`).exec(payload || "");
    if (match) {
      urls.push(match[1].replace(/\\\//g, "/"));
      continue;
    }
    const plain = new RegExp(`"${key}":"(https://vidlop\\.com/video/[^"]+)"`).exec(payload || "");
    if (plain)
      urls.push(plain[1]);
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

// src/dizifilm/index.js
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
    const embeds = parseEpisodeEmbeds(payload);
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
function resolveTarget(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    const { title, originalTitle, turkishTitle, year } = yield getTmdbInfo(tmdbId, type);
    const targets = [...new Set([turkishTitle, title, originalTitle].filter(Boolean))];
    if (!targets.length)
      return null;
    const contentType = expectedContentType(type);
    let resolved = null;
    for (const domain of DOMAIN_CANDIDATES) {
      const candidates = yield searchCandidates(domain, targets, year, contentType);
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
    if (!resolved || !resolved.parts.length)
      return null;
    const suffix = year ? ` (${year})` : "";
    resolved.mediaTitle = type === "tv" ? `${resolved.candidate.title || title} S${season}E${episode}` : `${resolved.candidate.title || title}${suffix}`;
    return resolved;
  });
}
function getStreams(tmdbId, mediaType = "movie", season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const resolved = yield resolveTarget(tmdbId, mediaType, season, episode);
      if (!resolved)
        return [];
      const mediaTitle = resolved.mediaTitle;
      const streams = [];
      const seen = /* @__PURE__ */ new Set();
      for (const part of resolved.parts) {
        let hostStreams = [];
        try {
          hostStreams = yield extractVidlop(part.url, resolved.referer);
        } catch (e) {
          hostStreams = [];
        }
        for (const stream of hostStreams) {
          if (!stream.url || seen.has(stream.url))
            continue;
          seen.add(stream.url);
          const label = langLabel(part.language);
          streams.push({
            name: `Dizifilm ${label} \u2022 ${part.title}`,
            title: mediaTitle,
            url: stream.url,
            quality: part.quality || "Auto",
            headers: stream.headers,
            provider: "dizifilm",
            type: stream.type,
            subtitles: stream.subtitles || []
          });
        }
      }
      return streams;
    } catch (e) {
      return [];
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
          partSubs = yield extractVidlopSubtitles(part.url, resolved.referer);
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
module.exports = { getStreams, getSubtitles };
