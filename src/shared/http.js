export const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
};

// Nuvio runtime'ı tek instance; timeout'suz fetch upstream takılırsa provider
// kilitlenir (uygulamayı aç-kapa gerektirir). İki katmanlı koruma:
//  1) signal: AbortSignal.timeout(ms) → asıl fetch bağlantısını gerçekten iptal
//     eder (gerçek Nuvio provider'larında — ör. dvdplay — kullanılan yöntem).
//  2) Promise.race + setTimeout → AbortSignal yoksa veya çalışmazsa promise'in
//     yine de sonuçlanmasını garantiler.
// Her ikisi de ortamda yoksa zarifçe timeout'suz devam eder (çökmeden).
export const DEFAULT_TIMEOUT_MS = 15000;

// Fetch'i süre dolunca GERÇEKTEN iptal eden bir signal döndürür.
//  1) AbortSignal.timeout varsa onu kullan (tek satır).
//  2) Yoksa elle AbortController + setTimeout ile abort et. Bu kritik: eski kod
//     bu durumda undefined dönüyordu; timeout'a düşen istekler soketi açık
//     bırakıyor, RN bağlantı havuzunu doldurup sonraki istekleri asıyordu
//     (upstream throttle'landığında "uzun izleyince donma" belirtisinin asıl
//     plugin tarafı sebebi buydu).
//  3) AbortController da yoksa undefined (withTimeout race yedeği yine reddeder).
export function timeoutSignal(ms = DEFAULT_TIMEOUT_MS) {
    try {
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
            return AbortSignal.timeout(ms);
        }
    } catch {
        // ignore, elle dene
    }
    try {
        if (typeof AbortController === 'function' && typeof setTimeout === 'function') {
            const controller = new AbortController();
            const timer = setTimeout(() => {
                try { controller.abort(); } catch { /* ignore */ }
            }, ms);
            // Node'da askıda timer event loop'u açık tutmasın; RN'de no-op.
            if (timer && typeof timer.unref === 'function') timer.unref();
            return controller.signal;
        }
    } catch {
        // ignore
    }
    return undefined;
}

export function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS, label = '') {
    // setTimeout her zaman tanımlı değil; yoksa timeout'suz devam et ki withTimeout'un
    // kendisi ReferenceError fırlatıp TÜM provider'ları çökertmesin.
    if (typeof setTimeout !== 'function') {
        return Promise.resolve(promise);
    }
    let timer = null;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`Timeout after ${ms}ms${label ? ` (${label})` : ''}`));
        }, ms);
    });
    return Promise.race([promise, timeout]).then(
        value => { if (timer) clearTimeout(timer); return value; },
        error => { if (timer) clearTimeout(timer); throw error; }
    );
}

export async function fetchText(url, options = {}) {
    const { timeout = DEFAULT_TIMEOUT_MS, ...rest } = options;
    return await withTimeout((async () => {
        const response = await fetch(url, {
            headers: {
                ...DEFAULT_HEADERS,
                ...rest.headers
            },
            signal: timeoutSignal(timeout),
            ...rest
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on ${url}`);
        }

        return await response.text();
    })(), timeout, url);
}
