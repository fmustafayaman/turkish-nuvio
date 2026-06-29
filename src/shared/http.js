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

// AbortSignal.timeout bu runtime'da varsa fetch'i gerçekten iptal eden bir
// signal döndürür; yoksa undefined (fetch normal çalışır, race yedeği devreye girer).
export function timeoutSignal(ms = DEFAULT_TIMEOUT_MS) {
    try {
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
            return AbortSignal.timeout(ms);
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
