#!/bin/bash
# Nightly backup on the server: database (compressed) and uploaded media, old copies removed after KEEP_DAYS.
# Reads the database connection from connection.config.
# Author: Khadim Gueye
# Usage: sql/backup_nightly.sh    (cron: 30 2 * * * /path/to/malaria-dashboard/sql/backup_nightly.sh)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${CONNECTION_CONFIG:-$ROOT/connection.config}"
if [ -f "$CONFIG" ]; then
  while IFS="=" read -r key value; do
    value="${value%$'\r'}"
    value="${value#[\"\']}"
    value="${value%[\"\']}"
    if [ -z "${!key:-}" ]; then export "$key=$value"; fi
  done < <(grep -E '^DB_(HOST|PORT|NAME|USER|PASSWORD)=' "$CONFIG")
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
MYSQLDUMP="${MYSQLDUMP:-mysqldump}"
STAMP="$(date +%Y%m%d_%H%M)"
mkdir -p "$BACKUP_DIR"

FILE="$BACKUP_DIR/${DB_NAME:-malaria_dashboard}_$STAMP.sql.gz"
trap 'rm -f "$FILE.part"' EXIT
MYSQL_PWD="${DB_PASSWORD:-}" "$MYSQLDUMP" -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "${DB_USER:-malaria_app}" \
  --default-character-set=utf8mb4 --single-transaction --routines --no-tablespaces "${DB_NAME:-malaria_dashboard}" | gzip > "$FILE.part"
mv "$FILE.part" "$FILE"

if [ -d "$ROOT/api/media" ]; then
  tar -czf "$BACKUP_DIR/media_$STAMP.tar.gz" -C "$ROOT/api" media
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name '*.sql.gz' -o -name 'media_*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "Backup written to $FILE"
