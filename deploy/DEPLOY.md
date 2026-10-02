# Deploying the dashboard on a VPS (Contabo, Ubuntu 24.04)

Author: Khadim Gueye

The whole site (website, admin area, API and database) runs on one server, behind one address. Only two DNS records
are needed.

## 1. Before you start

- A VPS with Ubuntu 24.04, its IP address and root password (Contabo shows them in the Control Panel).
- The domain, for example `clustaintelligence.africa`.
- On this computer, MySQL running in XAMPP.

## 2. Point the domain to the server

In Namecheap > Domain List > Manage > Advanced DNS, remove the parking records and add:

| Type | Host | Value |
| --- | --- | --- |
| A Record | `@` | the server IP |
| A Record | `www` | the server IP |

It usually works within 30 minutes.

## 3. Build the package (on this computer)

```
.\deploy\make_package.ps1
```

This builds the website, exports the current database, media and gene flow data, and writes
`deploy\package\malaria-dashboard.tar.gz` (about 10 MB).

## 4. Upload it

With FileZilla: protocol **SFTP**, host = server IP, user `root`, port 22. Upload the package to `/root`.

## 5. Install (once)

Connect to the server (`ssh root@SERVER_IP`, or the console in the Contabo panel) and run:

```
mkdir -p /opt/malaria-dashboard
tar -xzf /root/malaria-dashboard.tar.gz -C /opt/malaria-dashboard
bash /opt/malaria-dashboard/deploy/install.sh clustaintelligence.africa lab-email@example.org
```

The script installs MariaDB, Python, nginx, the firewall, security updates, the dashboard service, the nightly backup
(02:30, kept 30 days in `/opt/malaria-dashboard/backups`) and HTTPS. It ends with the setup check: every line must
say OK (WARN lines are optional).

If the domain did not point to the server yet, HTTPS is skipped. Run this later:

```
bash /opt/malaria-dashboard/deploy/enable_https.sh clustaintelligence.africa lab-email@example.org
```

Admin accounts and passwords are the same as on this computer.

## 6. Update after changes

On this computer: `.\deploy\make_package.ps1`, upload the new package to `/root`, then on the server:

```
rm -rf /root/update && mkdir /root/update
tar -xzf /root/malaria-dashboard.tar.gz -C /root/update
bash /root/update/deploy/update.sh
```

It makes a backup first, keeps uploads, settings and data, and applies only the new sql files.

## Useful commands on the server

| What | Command |
| --- | --- |
| Is the site running | `systemctl status malaria-dashboard` |
| Last errors | `journalctl -u malaria-dashboard -n 50` |
| Restart | `systemctl restart malaria-dashboard` |
| Backup now | `DB_HOST=localhost DB_USER=root DB_PASSWORD= bash /opt/malaria-dashboard/sql/backup_nightly.sh` |
| Setup check | `sudo -u malaria /opt/malaria-dashboard/venv/bin/python /opt/malaria-dashboard/api/check_setup.py` |

Copy the `backups` folder to another place from time to time (for example with FileZilla): a backup kept only on the
server does not survive the loss of the server.
