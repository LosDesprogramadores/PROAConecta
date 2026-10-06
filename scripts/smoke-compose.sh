#!/usr/bin/env bash
# Prueba de humo del stack local: levanta compose, espera healthy y consulta el backend.
set -euo pipefail

cd "$(dirname "$0")/.."

# En error se avisa pero NO se apagan los contenedores, para poder inspeccionarlos
trap 'echo "Hubo un error: los contenedores siguen arriba. Revisar con: docker compose ps / docker compose logs"' ERR

# Sin backend/.env se parte del ejemplo (solo placeholders)
if [ ! -f backend/.env ]; then
  [ -f backend/.env.example ] || { echo "ERROR: falta backend/.env.example; crearlo o copiarlo antes de correr el script"; exit 1; }
  cp backend/.env.example backend/.env
fi

docker compose up -d --build

echo "Esperando servicios healthy..."
for servicio in db mongo redis; do
  for _ in $(seq 1 30); do
    estado=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q "$servicio")" 2>/dev/null || true)
    [ "$estado" = "healthy" ] && break
    sleep 2
  done
  [ "$estado" = "healthy" ] || { echo "FALLO: $servicio no quedó healthy"; docker compose logs --tail=50 "$servicio"; exit 1; }
done

echo "Esperando al backend..."
codigo=000
for _ in $(seq 1 30); do
  codigo=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/schema/ || true)
  [ "$codigo" != "000" ] && break
  sleep 2
done

if [ "$codigo" -ge 200 ] && [ "$codigo" -lt 500 ]; then
  echo "OK: GET /api/schema/ respondió $codigo"
else
  echo "FALLO: GET /api/schema/ respondió $codigo"
  docker compose logs --tail=50 backend
  exit 1
fi

# WebSocket a través de nginx: el handshake debe completarse (101) aunque no haya ticket,
# y la app cierra enseguida con 4401. Un origen ajeno debe rechazarse con 403.
echo "Verificando el WebSocket..."
ws_codigo() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 3 --http1.1 \
    -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
    -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
    -H "Origin: $1" "http://localhost:4200/ws/notificaciones/" || true
}

codigo_ws=$(ws_codigo http://localhost:4200)
if [ "$codigo_ws" = "101" ]; then
  echo "OK: /ws/notificaciones/ aceptó el upgrade (101); sin ticket el servidor cierra con 4401"
else
  echo "FALLO: /ws/notificaciones/ respondió $codigo_ws (se esperaba 101)"
  docker compose logs --tail=50 frontend backend
  exit 1
fi

codigo_ajeno=$(ws_codigo http://sitio-malo.test)
if [ "$codigo_ajeno" = "403" ]; then
  echo "OK: un origen no permitido se rechaza (403)"
else
  echo "FALLO: origen ajeno respondió $codigo_ajeno (se esperaba 403)"
  exit 1
fi
