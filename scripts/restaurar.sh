#!/usr/bin/env bash
# Restaura PostgreSQL (pg_restore --clean --if-exists --no-owner) y MongoDB (mongorestore --drop) desde
# los archivos generados por scripts/respaldo.sh. DESTRUCTIVO: pisa los datos actuales de las dos bases.
#
# Uso: ./scripts/restaurar.sh --si <postgres.dump> <mongo.archive.gz>
#
# Primero generar los archivos con ./scripts/respaldo.sh. Antes de borrar nada se valida que los dos
# archivos se puedan leer. PostgreSQL se restaura en una sola transacción (si falla, queda como estaba);
# MongoDB se restaura después, solo las colecciones de MONGO_DB_NAME (por defecto proa_conecta).
# Mismos modos y variables que respaldo.sh: DATABASE_URL + DATABASE_URL_MONGODB (directo) o PROA_COMPOSE=1
# con PROA_COMPOSE_CMD opcional (compose). Sin --si no hace nada.
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib-url.sh
. "$aqui/lib-url.sh"
cd "$aqui/.."
umask 077
base_mongo="${MONGO_DB_NAME:-proa_conecta}"
config_mongo=''
trap '[ -z "$config_mongo" ] || rm -f "$config_mongo"' EXIT

uso() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}

confirmado=0
if [ "${1:-}" = "--si" ]; then confirmado=1; shift; fi
case "${1:-}" in -h|--help) uso 0 ;; esac

[ "$#" -eq 2 ] || { echo "ERROR: se esperan dos archivos (postgres y mongo)" >&2; uso 1 >&2; }
archivo_pg="$1"
archivo_mongo="$2"
[ -f "$archivo_pg" ] || { echo "ERROR: no existe $archivo_pg" >&2; exit 1; }
[ -f "$archivo_mongo" ] || { echo "ERROR: no existe $archivo_mongo" >&2; exit 1; }

if [ "${PROA_COMPOSE:-}" = "1" ]; then
  read -r -a compose <<< "${PROA_COMPOSE_CMD:-docker compose}"
  objetivo="contenedores db y mongo de: ${compose[*]}"
else
  [ -n "${DATABASE_URL:-}" ] || { echo "ERROR: falta DATABASE_URL" >&2; uso 1 >&2; }
  [ -n "${DATABASE_URL_MONGODB:-}" ] || { echo "ERROR: falta DATABASE_URL_MONGODB" >&2; uso 1 >&2; }
  command -v pg_restore >/dev/null || { echo "ERROR: falta pg_restore (o usar PROA_COMPOSE=1)" >&2; exit 1; }
  command -v mongorestore >/dev/null || { echo "ERROR: falta mongorestore (o usar PROA_COMPOSE=1)" >&2; exit 1; }
  # Se muestran solo host y base: nunca usuario ni clave (se corta en la última '@')
  objetivo="PostgreSQL $(url_sin_credenciales "$DATABASE_URL") y MongoDB $(url_sin_credenciales "$DATABASE_URL_MONGODB")"
fi

echo "Destino: $objetivo"
echo "Origen:  $archivo_pg y $archivo_mongo"
[ "$confirmado" -eq 1 ] || { echo "ABORTADO: la restauración es destructiva; repetir con --si para confirmar" >&2; exit 1; }

# Validación previa: un archivo corrupto se detecta ANTES de borrar los datos actuales
gzip -t "$archivo_mongo" 2>/dev/null || { echo "ERROR: $archivo_mongo no es un gzip válido" >&2; exit 1; }
if [ "${PROA_COMPOSE:-}" = "1" ]; then
  "${compose[@]}" exec -T db pg_restore -l < "$archivo_pg" > /dev/null \
    || { echo "ERROR: $archivo_pg no es un dump de PostgreSQL legible" >&2; exit 1; }
  if "${compose[@]}" exec -T mongo mongorestore --help 2>&1 | grep -q -- '--dryRun'; then
    "${compose[@]}" exec -T mongo mongorestore --dryRun --archive --gzip --nsInclude "${base_mongo}.*" < "$archivo_mongo" > /dev/null 2>&1 \
      || { echo "ERROR: $archivo_mongo no es un archivo de mongodump legible" >&2; exit 1; }
  else
    echo "Nota: este mongorestore no tiene --dryRun; solo se validó el gzip del archivo de Mongo"
  fi
else
  pg_exportar_entorno "$DATABASE_URL"
  config_mongo="$(mktemp)"
  mongo_escribir_config "$DATABASE_URL_MONGODB" "$config_mongo"
  pg_restore -l "$archivo_pg" > /dev/null \
    || { echo "ERROR: $archivo_pg no es un dump de PostgreSQL legible" >&2; exit 1; }
  if mongorestore --help 2>&1 | grep -q -- '--dryRun'; then
    mongorestore --config "$config_mongo" --dryRun --archive="$archivo_mongo" --gzip --nsInclude "${base_mongo}.*" > /dev/null 2>&1 \
      || { echo "ERROR: $archivo_mongo no es un archivo de mongodump legible" >&2; exit 1; }
  else
    echo "Nota: este mongorestore no tiene --dryRun; solo se validó el gzip del archivo de Mongo"
  fi
fi

# --single-transaction (implica --exit-on-error) es compatible con --clean: si algo falla, PostgreSQL
# vuelve a su estado anterior. MongoDB no es transaccional: si falla después, PostgreSQL ya quedó restaurado.
if [ "${PROA_COMPOSE:-}" = "1" ]; then
  # shellcheck disable=SC2016  # las variables se expanden dentro del contenedor
  "${compose[@]}" exec -T db sh -c 'pg_restore --clean --if-exists --no-owner --exit-on-error --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$archivo_pg"
  "${compose[@]}" exec -T mongo mongorestore --drop --archive --gzip --nsInclude "${base_mongo}.*" < "$archivo_mongo"
else
  pg_restore --clean --if-exists --no-owner --exit-on-error --single-transaction -d "$PGDATABASE" "$archivo_pg"
  mongorestore --config "$config_mongo" --drop --archive="$archivo_mongo" --gzip --nsInclude "${base_mongo}.*"
fi

echo "OK: restauración terminada"
