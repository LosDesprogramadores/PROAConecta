// Same-origin URLs: nginx proxies /api/ and /ws/ to the backend.
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

export const environment = {
    production: true,
    apiUrl: '/api/',
    wsUrl: `${wsProtocol}//${location.host}/ws/notificaciones/`,
};
