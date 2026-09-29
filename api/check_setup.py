#!/usr/bin/env python3
# Checks that a server is ready: configuration, database, tables, owner account, files.
# Usage: python api/check_setup.py   (exit code 1 if something blocks the site)
# Author: Khadim Gueye

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
import db
from security import JWT_SECRET

HERE = os.path.dirname(os.path.abspath(__file__))

TABLES = [
    "admin_users", "alert_levels", "alert_rules", "articles", "audit_log", "genes", "hrp_deletions",
    "lab_activities", "mis_prevalence", "moi_distribution", "mutations", "observations", "partners",
    "publications", "report_downloads", "sequencing_batches", "site_settings", "site_visits",
    "species_observations", "states", "team_members", "uploads",
]
COLUMNS = {
    "team_members": ["linkedin_url", "is_alumni", "is_deleted"],
    "lab_activities": ["sort_order", "is_deleted"],
    "partners": ["is_visible", "is_deleted"],
}

problems = 0


def report(ok, text, blocking=True):
    global problems
    if not ok and blocking:
        problems += 1
    print(f"{'OK  ' if ok else ('FAIL' if blocking else 'WARN')}  {text}")


def main():
    report(config.LOADED, f"connection.config read from {config.CONFIG_FILE}", blocking=False)
    info = db.CONN_INFO
    try:
        conn = db.connect()
    except Exception as err:
        report(False, f"database {info['database']} on {info['host']}:{info['port']} as {info['user']}: {err}")
        return
    report(True, f"database {info['database']} on {info['host']}:{info['port']} as {info['user']}")
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE()"
            )
            found = {}
            for row in cur.fetchall():
                found.setdefault(row["t"].lower(), set()).add(row["c"].lower())
            missing = [t for t in TABLES if t not in found]
            report(not missing, "all tables present" if not missing else f"missing tables: {', '.join(missing)}")
            gaps = [f"{t}.{c}" for t, cols in COLUMNS.items() if t in found for c in cols if c not in found[t]]
            report(not gaps, "latest columns present" if not gaps else f"run the sql migrations, missing: {', '.join(gaps)}")
            if "admin_users" in found:
                cur.execute("SELECT COUNT(*) AS n FROM admin_users WHERE is_owner = 1 AND is_active = 1")
                report(cur.fetchone()["n"] > 0, "owner account exists")
            if "observations" in found:
                cur.execute("SELECT COUNT(*) AS n FROM observations")
                report(cur.fetchone()["n"] > 0, "surveillance data loaded", blocking=False)
    except Exception as err:
        report(False, f"reading the database: {err}")
    finally:
        conn.close()

    report(not JWT_SECRET.startswith("dev-only"), "JWT_SECRET set for production", blocking=False)
    media = os.path.join(HERE, "media")
    os.makedirs(media, exist_ok=True)
    report(os.access(media, os.W_OK), f"media folder writable ({media})")
    dist = os.path.realpath(os.environ.get("FRONTEND_DIR", os.path.join(HERE, "..", "frontend", "dist")))
    report(os.path.isfile(os.path.join(dist, "index.html")), f"built website found ({dist})", blocking=False)
    report(os.path.isfile(os.path.join(HERE, "geo", "ipv4.bin")), "visitor location files (api/geo)", blocking=False)


if __name__ == "__main__":
    main()
    print("Ready." if problems == 0 else f"{problems} problem(s) to fix before starting the site.")
    sys.exit(1 if problems else 0)
