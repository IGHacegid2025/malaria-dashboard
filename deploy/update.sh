#!/bin/bash
# Updates the server with a new package, run as root from the folder where the new package was unpacked:
#   bash deploy/update.sh
# Keeps connection.config, uploaded media, gene flow data and backups. Applies new sql files only once.
# Author: Khadim Gueye

set -euo pipefail

APP_DIR="/opt/malaria-dashboard"
APP_USER="malaria"
DB_NAME="malaria_dashboard"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then echo "Run as root."; exit 1; fi
if [ "$SRC" = "$APP_DIR" ]; then echo "Unpack the new package in another folder (for example /root/update) and run its deploy/update.sh."; exit 1; fi

echo "==> Backup before update"
DB_HOST=localhost DB_USER=root DB_PASSWORD= BACKUP_DIR="$APP_DIR/backups" bash "$APP_DIR/sql/backup_nightly.sh"

echo "==> Copying the new version"
for part in api frontend/dist sql deploy passenger_wsgi.py connection.config.example NEW_STACK_README.md; do
  [ -e "$SRC/$part" ] || continue
  mkdir -p "$APP_DIR/$(dirname "$part")"
  if [ -d "$SRC/$part" ]; then
    rsync -a --delete --exclude media --exclude geo --exclude __pycache__ "$SRC/$part/" "$APP_DIR/$part/"
  else
    cp "$SRC/$part" "$APP_DIR/$part"
  fi
done
if [ -d "$SRC/api/geo" ]; then rsync -a "$SRC/api/geo/" "$APP_DIR/api/geo/"; fi

echo "==> Python packages"
"$APP_DIR/venv/bin/pip" install -q -r "$APP_DIR/api/requirements.txt"

echo "==> Database changes"
mysql "$DB_NAME" -e "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(120) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE = InnoDB;"
for f in "$APP_DIR"/sql/[0-9][0-9]_*.sql; do
  name="$(basename "$f")"
  case "$name" in 01_*|02_*|03_*|04_*) continue ;; esac
  done_already="$(mysql -N "$DB_NAME" -e "SELECT COUNT(*) FROM schema_migrations WHERE name = '$name'")"
  if [ "$done_already" = "0" ]; then
    echo "applying $name"
    mysql --default-character-set=utf8mb4 < "$f"
    mysql "$DB_NAME" -e "INSERT INTO schema_migrations (name) VALUES ('$name');"
  fi
done

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/connection.config"
systemctl restart malaria-dashboard
sleep 3
curl -sf http://127.0.0.1:8000/api/health && echo " Update done." || { echo "The API did not start: journalctl -u malaria-dashboard -n 50"; exit 1; }
