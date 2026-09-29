# Malaria Dashboard - New Stack (dev branch)

MySQL database (XAMPP), FastAPI backend, React frontend. It runs alongside the
old Fathom dashboard (see `README.md`) without touching it.

Author: Khadim Gueye

## One-time setup

1. Install XAMPP and start **MySQL** from the XAMPP Control Panel.
2. Create the database, tables, reference data and owner account (from the project root, in PowerShell):

   ```bash
   C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\01_create_database.sql
   C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\02_create_tables.sql
   C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\03_data.sql
   C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\04_seed_admin.sql
   C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\05_who_status_team.sql
   C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\06_visitors_reports_activities.sql
   ```

   See `sql/README.md` for details, backups and the test database.

3. Create the conda environment (in WSL):

   ```bash
   conda create -n malaria_dashboard --override-channels -c conda-forge \
     python=3.11 nodejs=22 fastapi uvicorn pymysql cryptography bcrypt python-jose python-multipart openpyxl httpx
   ```

   On a server without conda: `pip install -r api/requirements.txt`.

## Starting the dashboard

MySQL must be running in XAMPP. Then in WSL:

```bash
cd "/mnt/c/Users/IGH IT/Documents/work/malaria/malaria-dashboard"
./start_dashboard.sh
```

Open **http://localhost:5173** in your browser. Stop everything with `Ctrl+C`.

| Service | URL |
| --- | --- |
| Dashboard | http://localhost:5173 |
| Admin area | http://localhost:5173/admin |
| API documentation | http://127.0.0.1:8000/docs |
| phpMyAdmin | http://localhost/phpmyadmin |

To work on the test database instead: `DB_NAME=malaria_dashboard_test ./start_dashboard.sh`.

## Admin area

Sign in at `/admin`. The owner (`khadimg@run.edu.ng`, temporary password `admin`) must choose a new
password at the first sign-in.

| Feature | Admin | Super admin |
| --- | --- | --- |
| Submit data with the Excel templates (validation before saving) | yes | yes |
| Hide an upload or a record | yes | yes |
| Restore a hidden upload or record | no | yes |
| Edit WHO thresholds and alert messages | yes | yes |
| Edit site texts, colours, text size, announcement | yes | yes |
| Add, remove, promote or demote admins | no | yes |
| Read the audit log | no | yes |
| Team members and lab activities: add, edit, remove | yes | yes |
| Restore or permanently delete a removed member or activity | no | yes |
| Publish a gene flow year (tree + metadata), hide it | yes | yes |
| Website visitors map, PDF report downloads (name, email, country) | yes | yes |

The owner account cannot be modified by anyone else. After 5 wrong passwords an account is locked
for 15 minutes. Every sign-in and change is written to the audit log.

Excel templates are in `templates/` and can also be downloaded from the Submit data page.
Regenerate them after adding genes with `python api/build_templates.py`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | local XAMPP values | Database connection |
| `JWT_SECRET` | development value | Signs admin sessions. **Set a long random value in production.** |
| `TOKEN_HOURS` | `8` | Session length |
| `ALLOWED_ORIGINS` | `*` | Frontend URLs allowed to call the API |
| `VITE_API_URL` (frontend) | empty | API URL when frontend and API are on different hosts |
| `TRUST_PROXY` | `0` | Set to `1` behind nginx or another reverse proxy so the visitor IP is read from `X-Forwarded-For` |
| `GENE_FLOW_DIR` | `data_analysis/gene_flow` | One folder per year with `strainhub_tree.treefile` and `strainhub_metadata.csv` |
| `FRONTEND_DIR` | `frontend/dist` | Built website served by the API (production) |
| `CONNECTION_CONFIG` | `connection.config` | Path of the configuration file |

## Deploying to a server

The server only needs Python 3.10+ and a MySQL or MariaDB database. Node is not needed there: the website
is built on this computer and the API serves it, so one process runs the whole site.

1. On this computer, build the website and export the data:

   ```bash
   cd frontend && npm run build          # writes frontend/dist
   .\sql\export_for_deploy.ps1           # writes sql/deploy/ (database.sql, media/, gene_flow/)
   ```

2. On the hosting panel, create an empty database and a user with all rights on it.
   Import `sql/deploy/database.sql` into it (phpMyAdmin > Import, or `mysql -u USER -p DBNAME < database.sql`).
   The file has no database name inside, so any name given by the host works.

3. Copy the project to the server (without `node_modules`), then:
   - `sql/deploy/media/` to `api/media/`
   - `sql/deploy/gene_flow/` to `data_analysis/gene_flow/`
   - `connection.config.example` to `connection.config`, filled with the values of the host
     (database, a long random `JWT_SECRET`, the site address in `ALLOWED_ORIGINS`, `TRUST_PROXY=1` behind a proxy)

4. Install and check:

   ```bash
   pip install -r api/requirements.txt
   python api/check_setup.py              # every line must be OK (WARN lines are optional)
   ```

5. Start: `cd api && uvicorn main:app --host 0.0.0.0 --port 8000` (or the command the host asks for).
   The website, the admin area and the API are then all on the same address.

Environment variables still win over `connection.config`, for hosts that set them in their panel.
`connection.config` holds passwords: it is ignored by git and must never be shared.

## Deploying on cPanel hosting (Namecheap Stellar and similar)

cPanel runs Python apps through Passenger (WSGI). `passenger_wsgi.py` at the project root wraps the FastAPI app with
`a2wsgi`, so the site, the admin area and the API run as one application. Tested locally under a WSGI server with the
full smoke test (`SMOKE_WSGI=1`), page loads, uploads up to 18 MB and downloads. The host does not officially support
ASGI apps behind this adapter, so keep the Netlify and Render option in mind.

1. On this computer: `cd frontend && npm run build`, then `.\sql\export_for_deploy.ps1`.
2. cPanel > MySQL Databases: create a database and a user with all privileges. phpMyAdmin > Import `sql/deploy/database.sql`.
3. Upload the project with FileZilla (without `node_modules`), including `frontend/dist`, plus `sql/deploy/media` into
   `api/media` and `sql/deploy/gene_flow` into `data_analysis/gene_flow`.
4. Create `connection.config` from `connection.config.example` (database from step 2, `JWT_SECRET`, SMTP of a
   cPanel email account, `TRUST_PROXY=1`).
5. cPanel > Setup Python App > Create: Python 3.11, application root = the project folder, startup file
   `passenger_wsgi.py`, entry point `application`. Run pip install with `api/requirements.txt`, then Restart.
6. Run `python api/check_setup.py` in the app's terminal (or SSH) and open the site.

## Deploying with Netlify (site) and Render (API)

The website is built by Netlify from `netlify.toml`, the API runs on Render from `render.yaml`, the database is any
MySQL service (for example Aiven, free plan).

1. Database: create the MySQL service, download its CA certificate (`ca.pem`), then from this computer
   `.\sql\export_for_deploy.ps1 -WithoutPersonalData` and
   `C:\xampp\mysql\bin\mysql.exe -h HOST -P PORT -u USER -p --ssl-ca=ca.pem DBNAME < sql\deploy\database.sql`.
2. API: Render > New > Blueprint > this repository. Fill in `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
   add `ca.pem` under Secret Files, and set `ALLOWED_ORIGINS` to the website address. Check `/api/health`.
3. Website: Netlify > Add new project > this repository, branch `dev` for a test. Add the environment variable
   `VITE_API_URL` with the Render address (for example `https://malaria-dashboard-api.onrender.com`) and deploy.
4. Domain: in Netlify > DNS > para-sight.org, add a CNAME `api` pointing to the Render address, add `api.para-sight.org`
   as custom domain in Render, then use `https://api.para-sight.org` in `VITE_API_URL`.

Files in `api/media` (uploaded logos and banners) are not in git: upload them again from the admin area. On the Render
free plan, files uploaded later are lost when the API is redeployed.

## Running in production

**HTTPS.** Put the site behind a web server that handles certificates. With Caddy, this is the whole configuration
(the certificate is obtained and renewed automatically), then set `TRUST_PROXY=1` in `connection.config`:

```
para-sight.org {
    reverse_proxy 127.0.0.1:8000
}
```

**Nightly backup.** `sql/backup_nightly.sh` saves the database (compressed) and `api/media` to `backups/`, and removes
copies older than 30 days (`KEEP_DAYS`). Add it to cron on the server (`crontab -e`):

```
30 2 * * * /path/to/malaria-dashboard/sql/backup_nightly.sh >> /path/to/malaria-dashboard/backups/backup.log 2>&1
```

Copy the `backups/` folder to another machine or cloud storage from time to time: a backup on the same server does not
survive the loss of that server. On this Windows computer, `sql\backup_database.ps1` does the same by hand.

**Alert when the site is down.** `https://para-sight.org/api/health` answers `{"status":"ok"}` only when the API and the
database both work. Add this address to a free monitoring service (for example UptimeRobot, check every 5 minutes) with
the lab email as contact.

**Two-step sign-in.** Once `SMTP_HOST` and `SMTP_FROM` are set in `connection.config`, super admins receive a 6-digit
code by email after their password (valid 10 minutes, 5 tries). Admins keep signing in with the password only. Set
`TWO_FACTOR=0` to switch it off. `python api/check_setup.py` tells whether the email server is set.

**DOI and data release.** Create a free account on zenodo.org, upload a snapshot of the data (the CSV exports and a short
description), choose "Dataset" and publish: Zenodo gives a DOI like `10.5281/zenodo.1234567`. Enter it in Admin > Site
settings with the data release number and date. They then appear in the citation, the footer and the PDF report. For a
new release, create a new version of the same Zenodo record and update the three fields.

**Sharing preview.** Links shared on WhatsApp, LinkedIn or by email show `frontend/public/og-image.jpg` with the site
title. Rebuild the image with `python assets/make_og_image.py` after changing the photo or the text.

## Visitor locations

Visits and PDF report requests are located from the IP address with the free DB-IP city database
(no account needed, attribution "IP Geolocation by DB-IP" is shown in the admin area). Install or update it once a month:

```bash
cd api/geo
curl -LO https://download.db-ip.com/free/dbip-city-lite-2026-09.csv.gz   # change the month
cd .. && python geo_lookup.py build geo/dbip-city-lite-2026-09.csv.gz
python geo_lookup.py 102.89.1.1                                        # quick check
```

The build writes compact files in `api/geo/` (about 140 MB, not in git). Without them visits are still
counted, only without a place. Simple visits store a hash of the IP, never the IP itself; admin pages are not counted.

## Gene flow

The Genomics page rebuilds a gene flow network for each year from the phylogenetic tree and its metadata,
with the StrainHub parsimony method: the state of every ancestor is reconstructed (Fitch), and every change of
state along a branch counts as one flow between two states. Out-degree, in-degree, betweenness, closeness and
source hub ratio are computed on that network. Admins publish a new year from Admin > Population genomics;
the files are saved in `GENE_FLOW_DIR/<year>/`. Check a folder from the command line with `python api/gene_flow.py 2021`.

## Project layout

```
malaria-dashboard/
├── sql/                  database creation, reference data, owner, backup, reset, test database
├── templates/            Excel templates for data submission
├── api/                  FastAPI backend (main.py public API, admin_routes.py, uploads.py, security.py,
│                         audience_routes.py visits and reports, genomics_routes.py, gene_flow.py, geo_lookup.py)
├── data_analysis/        population genomics results (gene_flow/<year>/)
│   └── tests/            admin smoke test (test database only)
├── frontend/             React + TypeScript + Vite app (src/admin is the admin area)
├── start_dashboard.sh    starts the API and the frontend
├── site/                 old Fathom dashboard (still in production, untouched)
└── NEW_STACK_README.md
```
