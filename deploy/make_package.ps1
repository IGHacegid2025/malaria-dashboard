# Builds the package to upload to the server: deploy\package\malaria-dashboard.tar.gz
# It contains the built website, the API, the sql files, the current database export, media and gene flow data.
# Author: Khadim Gueye
# Usage (PowerShell, from the project root): .\deploy\make_package.ps1        (add -WithoutGeo to leave out the visitor location files)

param(
    [switch]$WithoutGeo
)

$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Output "Building the website"
$front = (wsl wslpath -a ($root -replace '\\', '/')).Trim() + "/frontend"
wsl -e bash -lc "source ~/miniconda3/etc/profile.d/conda.sh; conda activate malaria_dashboard; cd '$front' && npm run build" 2>&1 | Select-String -Pattern "built in|error" | ForEach-Object { $_.Line }
if ($LASTEXITCODE -ne 0 -or -not (Test-Path "frontend\dist\index.html")) { throw "Website build failed" }

Write-Output "Exporting the database, media and gene flow data"
& "$root\sql\export_for_deploy.ps1"
if ($LASTEXITCODE -ne 0) { throw "Database export failed" }

$out = Join-Path $PSScriptRoot "package"
New-Item -ItemType Directory -Force $out | Out-Null
$archive = Join-Path $out "malaria-dashboard.tar.gz"
if (Test-Path $archive) { Remove-Item $archive -Confirm:$false }

$items = @("api", "frontend\dist", "sql", "deploy", "passenger_wsgi.py", "connection.config.example", "NEW_STACK_README.md", "start_dashboard.sh")
$exclude = @("--exclude=__pycache__", "--exclude=api/media", "--exclude=sql/backups", "--exclude=deploy/package", "--exclude=connection.config", "--exclude=*.pyc", "--exclude=api/geo/*.csv.gz")
if ($WithoutGeo) { $exclude += "--exclude=api/geo" }

tar.exe -czf $archive @exclude -C $root $items
if ($LASTEXITCODE -ne 0) { throw "Packaging failed" }
Write-Output ("Package ready: {0} ({1} MB)" -f $archive, [math]::Round((Get-Item $archive).Length / 1MB, 1))
