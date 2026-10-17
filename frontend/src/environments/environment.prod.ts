// Same-origin URLs: nginx proxies /api/ and /ws/ to the backend.
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

export const environment = {
    production: true,
    apiUrl: 'http://localhost:8000/api/',
    wsUrl: 'ws://localhost:8000/ws/notificaciones/',
};
