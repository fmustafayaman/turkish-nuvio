export const BASE_URL = 'https://animecix.tv/';
export const API_URL = 'https://mangacix.net/';
export const VIDEO_PLAYER = 'tau-video.xyz';

// Cloudflare, eski Chrome major'larını (ör. 120) 403 ile engelliyor;
// güncel tarayıcı UA'sı veya UA'sız istek 200 dönüyor.
export const DEFAULT_HEADERS = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};

export const STREAM_HEADERS = {
    'User-Agent': DEFAULT_HEADERS['User-Agent'],
    'Referer': 'https://tau-video.xyz/',
    'Origin': 'https://tau-video.xyz'
};
