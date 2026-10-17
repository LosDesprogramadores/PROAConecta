#!/usr/bin/env bash
# Utilidades para URLs de conexión (se carga con `source` desde respaldo.sh y restaurar.sh).
# Evitan pasar claves en argv, donde cualquier usuario del equipo las ve con `ps`.

# Decodifica %XX de un fragmento de URL (usuario o clave).
url_decodificar() {
  local s="${1//\\/\\\\}"
  printf '%b' "${s//%/\\x}"
}

# Descompone una URL en URL_USUARIO, URL_CLAVE, URL_HOSTPORT, URL_HOST, URL_PUERTO, URL_RUTA y URL_QUERY.
# El separador de credenciales es la ÚLTIMA '@' del tramo de autoridad, así una clave con '@' sin codificar
# se interpreta bien. Se asume que la clave no contiene '/' ni '?' sin codificar.
url_parsear() {
  local url="$1" resto autoridad info
  URL_USUARIO='' URL_CLAVE='' URL_HOST='' URL_PUERTO='' URL_RUTA='' URL_QUERY=''
  [[ "$url" == *://* ]] || return 1
  resto="${url#*://}"
  autoridad="${resto%%/*}"
  # Sin '/' el resto puede traer solo '?query'
  [[ "$resto" == */* ]] || autoridad="${resto%%\?*}"
  URL_RUTA="${resto#"$autoridad"}"
  if [[ "$URL_RUTA" == *\?* ]]; then URL_QUERY="${URL_RUTA#*\?}"; URL_RUTA="${URL_RUTA%%\?*}"; fi
  URL_RUTA="${URL_RUTA#/}"
  URL_HOSTPORT="${autoridad##*@}"
  if [[ "$autoridad" == *@* ]]; then
    info="${autoridad%@*}"
    URL_USUARIO="$(url_decodificar "${info%%:*}")"
    if [[ "$info" == *:* ]]; then URL_CLAVE="$(url_decodificar "${info#*:}")"; fi
  fi
  URL_HOST="${URL_HOSTPORT%%:*}"
  if [[ "$URL_HOSTPORT" == *:* ]]; then URL_PUERTO="${URL_HOSTPORT##*:}"; fi
  return 0
}

# Imprime la URL sin usuario ni clave (host[:puerto]/ruta).
url_sin_credenciales() {
  url_parsear "$1" || { echo "(URL inválida)"; return 0; }
  printf '%s/%s' "$URL_HOSTPORT" "$URL_RUTA"
}

# Exporta las variables PG* para libpq a partir de una URL postgres://. Nada de esto viaja por argv.
pg_exportar_entorno() {
  url_parsear "$1" || { echo "ERROR: DATABASE_URL no es una URL válida" >&2; return 1; }
  export PGHOST="$URL_HOST" PGDATABASE="$URL_RUTA"
  if [ -n "$URL_PUERTO" ]; then export PGPORT="$URL_PUERTO"; fi
  if [ -n "$URL_USUARIO" ]; then export PGUSER="$URL_USUARIO"; fi
  if [ -n "$URL_CLAVE" ]; then export PGPASSWORD="$URL_CLAVE"; fi
  case "$URL_QUERY" in *sslmode=*) PGSSLMODE="${URL_QUERY#*sslmode=}"; export PGSSLMODE="${PGSSLMODE%%&*}" ;; esac
}

# Escribe en el archivo $2 una config YAML con la URI de Mongo ($1) para --config de mongodump/mongorestore.
# El archivo hereda el umask del llamador (077): el llamador lo borra con trap.
mongo_escribir_config() {
  local uri="${1//\\/\\\\}"
  uri="${uri//\"/\\\"}"
  printf 'uri: "%s"\n' "$uri" > "$2"
}
