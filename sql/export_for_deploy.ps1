# Prepares everything the server needs in sql/deploy/:
#   database.sql  full current database, without CREATE DATABASE or USE, so it can be imported
#                 into a database of any name (phpMyAdmin > Import, or mysql -u user -p name < database.sql)
#   media/        uploaded photos, logos, banners (goes to api/media on the server)
#   gene_flow/    published gene flow years (goes to data_analysis/gene_flow on the server)
# Author: Khadim Gueye
# Usage (PowerShell, from the project root): .\sql\export_for_deploy.ps1
# For a public test server: .\sql\export_for_deploy.ps1 -WithoutPersonalData (visits, downloads, sign-in codes and
# audit log exported empty)

param(
    [string]$Database = "malaria_dashboard",
    [string]$MysqlBin = "C:\xampp\mysql\bin",
    [switch]$WithoutPersonalData
)

$root = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $PSScriptRoot "deploy"
if (Test-Path $dir) { Remove-Item $dir -Recurse -Force -Confirm:$false }
New-Item -ItemType Directory -Force $dir | Out-Null
$file = Join-Path $dir "database.sql"

$dump = "$MysqlBin\mysqldump.exe"
$common = @("-u", "root", "--default-character-set=utf8mb4", "--single-transaction", "--routines", "--skip-add-locks", "--no-tablespaces")
if ($WithoutPersonalData) {
    $personal = @("site_visits", "report_downloads", "admin_login_codes", "audit_log")
    $skip = $personal | ForEach-Object { "--ignore-table=$Database.$_" }
    & $dump @common @skip $Database --result-file="$file"
    if ($LASTEXITCODE -eq 0) {
        $empty = Join-Path $dir "empty_tables.sql"
        & $dump @common --no-data $Database @personal --result-file="$empty"
        Get-Content $empty -Raw -Encoding UTF8 | Add-Content $file -Encoding UTF8
        Remove-Item $empty -Confirm:$false
    }
} else {
    & $dump @common $Database --result-file="$file"
}
if ($LASTEXITCODE -ne 0) {
    Write-Error "Export failed"
    exit 1
}
Write-Output "Database written to $file ($([math]::Round((Get-Item $file).Length / 1MB, 1)) MB)"

foreach ($pair in @(@("api\media", "media"), @("data_analysis\gene_flow", "gene_flow"))) {
    $source = Join-Path $root $pair[0]
    if (Test-Path $source) {
        Copy-Item $source (Join-Path $dir $pair[1]) -Recurse
        Write-Output "$($pair[0]) copied to $(Join-Path $dir $pair[1])"
    }
}
