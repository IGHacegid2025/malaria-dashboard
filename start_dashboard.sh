#!/bin/bash
# Starts the API and the frontend. Stop both with Ctrl+C.
# Test copy on other ports: DB_NAME=malaria_dashboard_test API_PORT=8001 WEB_PORT=5174 ./start_dashboard.sh
# Author: Khadim Gueye

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source ~/miniconda3/etc/profile.d/conda.sh
conda activate malaria_dashboard

if [ -z "$DB_HOST" ] && grep -qi microsoft /proc/version; then
  export DB_HOST="$(ip route | awk '/default/ {print $3; exit}')"
fi
export DB_HOST="${DB_HOST:-127.0.0.1}"
export API_PORT="${API_PORT:-8000}"
export WEB_PORT="${WEB_PORT:-5173}"

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  (cd "$ROOT/frontend" && npm install)
fi

cd "$ROOT/api"
uvicorn main:app --host 127.0.0.1 --port "$API_PORT" &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT INT TERM

sleep 2
if ! curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null; then
  echo "API cannot reach MySQL at $DB_HOST:3306. Is MySQL started in XAMPP?"
  exit 1
fi

echo "Database:  ${DB_NAME:-malaria_dashboard}"
echo "API:       http://127.0.0.1:$API_PORT/docs"
echo "Dashboard: http://localhost:$WEB_PORT"
cd "$ROOT/frontend"
npm run dev
