# Exports the full database (reference data, uploads, accounts, audit, settings) to sql/backups/,
# and copies the banner images and videos from api/media next to it.
# Author: Khadim Gueye
# Usage (PowerShell, from the project root): .\sql\backup_database.ps1

param(
    [string]$Database = "malaria_dashboard",
    [string]$MysqlBin = "C:\xampp\mysql\bin"
)

$dir = Join-Path $PSScriptRoot "backups"
New-Item -ItemType Directory -Force $dir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmm"
$file = Join-Path $dir ("{0}_{1}.sql" -f $Database, $stamp)

& "$MysqlBin\mysqldump.exe" -u root --default-character-set=utf8mb4 --single-transaction --routines --databases $Database --result-file="$file"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backup failed"
    exit 1
}
Write-Output "Database written to $file"

$media = Join-Path (Split-Path $PSScriptRoot -Parent) "api\media"
if (Test-Path $media) {
    $target = Join-Path $dir "media_$stamp"
    Copy-Item $media $target -Recurse
    Write-Output "Media copied to $target"
}
