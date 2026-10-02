#!/bin/bash
# First installation on a fresh Ubuntu 24.04 server (Contabo VPS or any VPS), run as root:
#   bash deploy/install.sh clustaintelligence.africa you@example.org
# Installs MariaDB, Python, nginx, HTTPS, firewall, the dashboard service and the nightly backup.
# The project must already be in /opt/malaria-dashboard (unpacked from the package made by deploy/make_package.ps1).
# Author: Khadim Gueye

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_DIR="/opt/malaria-dashboard"
APP_USER="malaria"
DB_NAME="malaria_dashboard"
DB_USER="malaria_app"

if [ "$(id -u)" -ne 0 ]; then echo "Run as root."; exit 1; fi
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then echo "Usage: bash deploy/install.sh <domain> <email for the HTTPS certificate>"; exit 1; fi
if [ ! -f "$APP_DIR/api/main.py" ]; then echo "The project is not in $APP_DIR. Upload and unpack the package first."; exit 1; fi

step() { echo; echo "==> $*"; }

step "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq python3 python3-venv python3-pip mariadb-server nginx certbot python3-certbot-nginx ufw unattended-upgrades curl dnsutils rsync
systemctl enable --now mariadb nginx

step "Application user and files"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR/api/media" "$APP_DIR/backups" "$APP_DIR/data_analysis/gene_flow"
if [ -d "$APP_DIR/sql/deploy/media" ]; then cp -r --update=none "$APP_DIR/sql/deploy/media/." "$APP_DIR/api/media/"; fi
if [ -d "$APP_DIR/sql/deploy/gene_flow" ]; then cp -r --update=none "$APP_DIR/sql/deploy/gene_flow/." "$APP_DIR/data_analysis/gene_flow/"; fi

step "Python environment"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install -q --upgrade pip
"$APP_DIR/venv/bin/pip" install -q -r "$APP_DIR/api/requirements.txt"

step "Database"
DB_PASSWORD="$(openssl rand -hex 24)"
mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
mysql -e "ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
mysql -e "GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;"
TABLES="$(mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_NAME'")"
if [ "$TABLES" -gt 0 ]; then
  echo "Database already has $TABLES tables, kept as it is."
elif [ -f "$APP_DIR/sql/deploy/database.sql" ]; then
  echo "Importing sql/deploy/database.sql"
  mysql --default-character-set=utf8mb4 "$DB_NAME" < "$APP_DIR/sql/deploy/database.sql"
else
  echo "No export found: creating the reference database from the sql files"
  for f in "$APP_DIR"/sql/[0-9][0-9]_*.sql; do
    [ "$(basename "$f")" = "01_create_database.sql" ] && continue
    mysql --default-character-set=utf8mb4 < "$f"
  done
fi
mysql "$DB_NAME" -e "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(120) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE = InnoDB;"
for f in "$APP_DIR"/sql/[0-9][0-9]_*.sql; do
  mysql "$DB_NAME" -e "INSERT IGNORE INTO schema_migrations (name) VALUES ('$(basename "$f")');"
done
mysql "$DB_NAME" -e "INSERT INTO site_settings (setting_key, setting_value) VALUES ('site.public_url', '\"https://$DOMAIN/\"') ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);"

step "Configuration"
CONFIG="$APP_DIR/connection.config"
if [ -f "$CONFIG" ]; then
  sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" "$CONFIG"
else
  cat > "$CONFIG" <<EOF
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
TRUST_PROXY=1
EOF
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$CONFIG"

step "Dashboard service"
cat > /etc/systemd/system/malaria-dashboard.service <<EOF
[Unit]
Description=Malaria genomic surveillance dashboard
After=network.target mariadb.service
Requires=mariadb.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR/api
ExecStart=$APP_DIR/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2 --proxy-headers
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now malaria-dashboard
systemctl restart malaria-dashboard

step "Web server"
cat > /etc/nginx/sites-available/malaria-dashboard <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/malaria-dashboard /etc/nginx/sites-enabled/malaria-dashboard
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

step "Firewall and security updates"
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable
dpkg-reconfigure -f noninteractive unattended-upgrades

step "Nightly backup (02:30)"
cat > /etc/cron.d/malaria-dashboard-backup <<EOF
30 2 * * * root DB_HOST=localhost DB_USER=root DB_PASSWORD= BACKUP_DIR=$APP_DIR/backups $APP_DIR/sql/backup_nightly.sh >> $APP_DIR/backups/backup.log 2>&1
EOF
chmod +x "$APP_DIR/sql/backup_nightly.sh" "$APP_DIR/deploy/"*.sh

step "HTTPS"
SERVER_IP="$(curl -s -4 https://ifconfig.me || true)"
DOMAIN_IP="$(dig +short "$DOMAIN" A | tail -1)"
if [ -n "$SERVER_IP" ] && [ "$SERVER_IP" = "$DOMAIN_IP" ]; then
  certbot --nginx --non-interactive --agree-tos -m "$EMAIL" --redirect -d "$DOMAIN" -d "www.$DOMAIN"
else
  echo "The domain does not point to this server yet ($DOMAIN -> ${DOMAIN_IP:-nothing}, server $SERVER_IP)."
  echo "Add the DNS records, wait a few minutes, then run: bash $APP_DIR/deploy/enable_https.sh $DOMAIN $EMAIL"
fi

step "Check"
sleep 3
sudo -u "$APP_USER" "$APP_DIR/venv/bin/python" "$APP_DIR/api/check_setup.py" || true
curl -s http://127.0.0.1:8000/api/health && echo
echo
echo "Done. Open https://$DOMAIN (or http://$SERVER_IP while the domain is not ready)."
