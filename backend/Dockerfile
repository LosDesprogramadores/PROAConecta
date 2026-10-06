FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Usuario sin privilegios: el proceso web no corre como root
RUN groupadd --system --gid 1000 appuser \
    && useradd --system --uid 1000 --gid appuser --home-dir /app --shell /usr/sbin/nologin appuser

WORKDIR /app

# Solo dependencias de ejecución (requirements.txt); las de pruebas viven en requirements-dev.txt.
# Todas tienen wheel (psycopg2-binary incluye libpq), por eso no hace falta compilador.
COPY requirements.txt /app/
RUN pip install -r requirements.txt

COPY --chown=appuser:appuser . /app/

# Carpeta de archivos subidos, escribible por appuser
RUN mkdir -p /app/proa/media && chown appuser:appuser /app/proa/media

WORKDIR /app/proa

USER appuser

EXPOSE 8000

# docker-compose define su propio command (migrate + uvicorn); esto es el arranque por defecto de la imagen
CMD ["uvicorn", "proa.asgi:application", "--host", "0.0.0.0", "--port", "8000"]
