// Same-origin URLs: nginx proxies /api/ and /ws/ to the backend.
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

export const environment = {
  production: true,
  apiUrl: window.location.origin.includes('localhost') 
    ? 'http://localhost:8000/api/' 
    : 'https://proaconecta-backend.onrender.com/api/',
  wsUrl: window.location.origin.includes('localhost') 
    ? 'ws://localhost:8000/ws/notificaciones/' 
    : 'wss://proaconecta-backend.onrender.com/ws/notificaciones/',
};