#!/usr/bin/env bash
# Respaldo de PostgreSQL (pg_dump -Fc) y MongoDB (mongodump --archive --gzip) con la fecha en el nombre.
#
# Dos modos, sin secretos en el script:
#   Directo   DATABASE_URL=postgres://... DATABASE_URL_MONGODB=mongodb://... ./scripts/respaldo.sh
#             (requiere pg_dump y mongodump instalados)
#   Compose   PROA_COMPOSE=1 ./scripts/respaldo.sh
#             ejecuta los dumps dentro de los contenedores db y mongo. Para otro proyecto o archivos:
#             PROA_COMPOSE=1 PROA_COMPOSE_CMD="docker compose -p proa-respaldo -f docker-compose.yml -f docker-compose.e2e.yml" ...
#
# Opcionales: PROA_RESPALDOS_DIR (por defecto respaldos/), MONGO_DB_NAME (por defecto proa_conecta).
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib-url.sh
. "$aqui/lib-url.sh"
cd "$aqui/.."

# Los respaldos tienen datos personales: solo el dueño puede leerlos (también el config temporal de Mongo)
umask 077

uso() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}
case "${1:-}" in -h|--help) uso 0 ;; esac

destino="${PROA_RESPALDOS_DIR:-respaldos}"
base_mongo="${MONGO_DB_NAME:-proa_conecta}"
sello=$(date +%Y%m%d-%H%M%S)
archivo_pg="$destino/postgres-$sello.dump"
archivo_mongo="$destino/mongo-$sello.archive.gz"

mkdir -p "$destino"
# Un respaldo a medias no sirve: si algo falla se borran los archivos parciales
config_mongo=''
trap 'rm -f "$archivo_pg" "$archivo_mongo"; echo "FALLO: respaldo incompleto, archivos parciales borrados" >&2' ERR
trap '[ -z "$config_mongo" ] || rm -f "$config_mongo"' EXIT

if [ "${PROA_COMPOSE:-}" = "1" ]; then
  read -r -a compose <<< "${PROA_COMPOSE_CMD:-docker compose}"
  echo "Modo compose: ${compose[*]}"
  # Las credenciales salen del entorno del contenedor (POSTGRES_USER/POSTGRES_DB), no del script
  # shellcheck disable=SC2016  # las variables se expanden dentro del contenedor
  "${compose[@]}" exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$archivo_pg"
  "${compose[@]}" exec -T mongo mongodump --db "$base_mongo" --archive --gzip > "$archivo_mongo"
else
  [ -n "${DATABASE_URL:-}" ] || { echo "ERROR: falta DATABASE_URL" >&2; uso 1 >&2; }
  [ -n "${DATABASE_URL_MONGODB:-}" ] || { echo "ERROR: falta DATABASE_URL_MONGODB" >&2; uso 1 >&2; }
  command -v pg_dump >/dev/null || { echo "ERROR: falta pg_dump (o usar PROA_COMPOSE=1)" >&2; exit 1; }
  command -v mongodump >/dev/null || { echo "ERROR: falta mongodump (o usar PROA_COMPOSE=1)" >&2; exit 1; }
  # Sin claves en argv: libpq lee PGHOST/PGUSER/PGPASSWORD... del entorno y mongodump la URI de un config 0600
  pg_exportar_entorno "$DATABASE_URL"
  config_mongo="$(mktemp)"
  mongo_escribir_config "$DATABASE_URL_MONGODB" "$config_mongo"
  pg_dump -Fc > "$archivo_pg"
  mongodump --config "$config_mongo" --db "$base_mongo" --archive --gzip > "$archivo_mongo"
fi

# Un archivo vacío significa que el dump falló sin avisar
[ -s "$archivo_pg" ] && [ -s "$archivo_mongo" ] || { echo "ERROR: algún respaldo quedó vacío" >&2; false; }

trap - ERR
echo "OK: $archivo_pg"
echo "OK: $archivo_mongo"
