// Nuvio runtime tek instance ve uzun ömürlü; bölüm/anime geçişlerinde tekrar
// eden upstream çağrılarını (TMDB info, anime araması) hafızada tutmak için
// küçük bir TTL cache. Amaç hem hız hem de upstream'e giden istek sayısını
// azaltıp IP throttle riskini düşürmek.
export function createTtlCache(defaultTtlMs = 30 * 60 * 1000, maxEntries = 200) {
    const store = new Map();

    function get(key) {
        const entry = store.get(key);
        if (!entry) return undefined;
        if (entry.expires <= Date.now()) {
            store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    function set(key, value, ttlMs = defaultTtlMs) {
        if (store.size >= maxEntries) {
            // En eski kaydı at (Map ekleme sırasını korur).
            const oldest = store.keys().next().value;
            if (oldest !== undefined) store.delete(oldest);
        }
        store.set(key, { value, expires: Date.now() + ttlMs });
    }

    // Sonucu cache'ten getir; yoksa fn() ile üret ve cache'le. Hata/boş sonuç
    // cache'lenmez ki geçici bir throttle kalıcı boş sonuca dönüşmesin.
    async function remember(key, fn, ttlMs = defaultTtlMs, isValid = v => v != null) {
        const cached = get(key);
        if (cached !== undefined) return cached;
        const value = await fn();
        if (isValid(value)) set(key, value, ttlMs);
        return value;
    }

    return { get, set, remember };
}
