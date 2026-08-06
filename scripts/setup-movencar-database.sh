#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute este script com sudo." >&2
  exit 1
fi

APP_DIR=/home/leandro/movencar/backend
DB_NAME=movencar
DB_USER=movencar_app
DB_PASSWORD="$(openssl rand -hex 24)"
ACCESS_SECRET="$(openssl rand -hex 48)"
REFRESH_SECRET="$(openssl rand -hex 48)"

if runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"
else
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"
fi

if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  runuser -u postgres -- createdb --owner="${DB_USER}" "${DB_NAME}"
fi

install -m 600 -o leandro -g leandro /dev/null "${APP_DIR}/.env"
cat > "${APP_DIR}/.env" <<EOF
NODE_ENV=development
PORT=3334
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}
ACCESS_TOKEN_SECRET=${ACCESS_SECRET}
REFRESH_TOKEN_SECRET=${REFRESH_SECRET}
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
CORS_ORIGINS=http://localhost:5173,http://38.242.145.11:5173
COOKIE_SECURE=false
LOG_LEVEL=info
EOF
chown leandro:leandro "${APP_DIR}/.env"
chmod 600 "${APP_DIR}/.env"

runuser -u leandro -- bash -lc "cd '${APP_DIR}' && npm run prisma:generate && npm run prisma:migrate && npm run prisma:seed"
echo "Banco MovenCar criado, migration aplicada e seed concluido."
