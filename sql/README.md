# Database (MySQL / MariaDB, XAMPP)

Author: Khadim Gueye

## Files

| File | Content |
| --- | --- |
| `01_create_database.sql` | Creates the `malaria_dashboard` database (utf8mb4) and the `malaria_app` user |
| `02_create_tables.sql` | Drops and recreates all tables (data, admin accounts, audit log, uploads, site settings) |
| `03_data.sql` | Reference data: the verified dataset (generated, do not edit by hand) |
| `04_seed_admin.sql` | Owner account (first super admin) and default site settings |
| `05_who_status_team.sql` | WHO status (validated / candidate) of alert rules, team members |
| `06_visitors_reports_activities.sql` | Website visits, PDF report requests, lab activities of the home page |
| `generate_data.py` | Rebuilds `03_data.sql` from `site/data/records.json`, `site/data/geneConfig.json` and the publication CSV files |
| `reset_to_reference.sql` | Removes everything added through admin uploads and brings back the reference data |
| `backup_database.ps1` | Full export (reference data, uploads, accounts, audit, settings) into `sql/backups/` |
| `setup_test_database.ps1` | Builds `malaria_dashboard_test`, a separate copy for safe testing |

## Install (or deploy)

Start MySQL from the XAMPP Control Panel, then from the project root:

```bash
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\01_create_database.sql
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\02_create_tables.sql
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\03_data.sql
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\04_seed_admin.sql
```

Then apply the migrations, which only add what is missing and can be run again safely on a live database:

```bash
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\05_who_status_team.sql
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\06_visitors_reports_activities.sql
```

With phpMyAdmin (http://localhost/phpmyadmin), import the files in the same order.

Warning: `02_create_tables.sql` erases all tables. On a database that already has uploads, run
`backup_database.ps1` first.

## Owner account

`04_seed_admin.sql` creates the owner `khadimg@run.edu.ng` with the temporary password `admin`.
The password must be changed at the first sign-in on `/admin`. The owner cannot be modified,
demoted or removed by any other admin.

## Reference data and test data

- Reference rows (from `03_data.sql`) have `upload_id = NULL`.
- Every row added in the admin area carries the `upload_id` of its file, so a whole upload can be hidden.
- Hidden rows (`is_hidden = 1`) are never deleted; a super admin can restore them.
- `reset_to_reference.sql` deletes all uploaded rows and un-hides reference rows. Accounts, audit log
  and settings are kept.

## Backups

```powershell
.\sql\backup_database.ps1
```

Writes `sql/backups/malaria_dashboard_YYYYMMDD_HHMM.sql`. Restore it with:

```bash
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql\backups\<file>.sql
```

## Test database

```powershell
.\sql\setup_test_database.ps1
bash api/tests/run_smoke.sh
```

The smoke test checks accounts, roles, uploads, hiding, thresholds, settings and the audit log.
It refuses to run on any database other than `malaria_dashboard_test`.

## Regenerate the reference data

After running the preprocessing pipeline (`site/preprocess/transform.py`):

```bash
cd sql
python3 generate_data.py
```

Records from outside Nigeria (imported cases reported in China) are skipped.
Publications are matched to their DOI and title through `all_publications_information.csv`
and `hrp_deletion_publication.csv`. Sources that match several papers are kept without DOI.
