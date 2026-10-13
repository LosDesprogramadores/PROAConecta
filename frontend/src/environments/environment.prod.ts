// Same-origin URLs: nginx proxies /api/ and /ws/ to the backend.
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

export const environment = {
    production: true,
    apiUrl: 'https://proaconecta-backend.onrender.com/api/',
    wsUrl: 'ws://proaconecta-backend.onrender.com/ws/notificaciones/',
};
