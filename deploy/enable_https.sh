#!/bin/bash
# Turns on HTTPS once the domain points to the server, run as root:
#   bash deploy/enable_https.sh clustaintelligence.africa you@example.org
# Author: Khadim Gueye

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then echo "Usage: bash deploy/enable_https.sh <domain> <email>"; exit 1; fi

SERVER_IP="$(curl -s -4 https://ifconfig.me || true)"
for name in "$DOMAIN" "www.$DOMAIN"; do
  ip="$(dig +short "$name" A | tail -1)"
  if [ "$ip" != "$SERVER_IP" ]; then
    echo "$name points to ${ip:-nothing}, this server is $SERVER_IP. Fix the DNS record and try again in a few minutes."
    exit 1
  fi
done
certbot --nginx --non-interactive --agree-tos -m "$EMAIL" --redirect -d "$DOMAIN" -d "www.$DOMAIN"
echo "HTTPS is on: https://$DOMAIN (renewed automatically)."
