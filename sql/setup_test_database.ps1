# Creates malaria_dashboard_test, a copy built from the same SQL files, for safe testing.
# Start the API with DB_NAME=malaria_dashboard_test to use it.
# Author: Khadim Gueye
# Usage (PowerShell, from the project root): .\sql\setup_test_database.ps1

param(
    [string]$MysqlBin = "C:\xampp\mysql\bin",
    [string]$TestDatabase = "malaria_dashboard_test"
)

$files = "01_create_database.sql", "02_create_tables.sql", "03_data.sql", "04_seed_admin.sql", "05_who_status_team.sql", "06_visitors_reports_activities.sql", "07_team_linkedin.sql", "08_who_compendium_2025.sql", "09_team_alumni.sql", "10_keep_records.sql", "11_projects_partners.sql", "12_projects_summary.sql", "13_activity_microscopy.sql", "14_partner_gates.sql", "15_report_ip_hash.sql", "16_download_kind.sql", "17_fix_map_downloads.sql", "18_data_release.sql", "19_login_codes.sql", "20_nmis_project.sql"
foreach ($name in $files) {
    $sql = Get-Content (Join-Path $PSScriptRoot $name) -Raw -Encoding UTF8
    $sql = $sql -replace "\bmalaria_dashboard\b", $TestDatabase
    $tmp = Join-Path $env:TEMP "malaria_test_$name"
    [IO.File]::WriteAllText($tmp, $sql, (New-Object Text.UTF8Encoding $false))
    cmd /c "`"$MysqlBin\mysql.exe`" -u root --default-character-set=utf8mb4 < `"$tmp`""
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed on $name"; exit 1 }
    [IO.File]::Delete($tmp)
}
Write-Output "Test database $TestDatabase is ready."
