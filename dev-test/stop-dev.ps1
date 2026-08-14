# Stops everything test-dev.ps1 starts: apps/api-byoc, apps/web, Prisma
# Studio, and the local Postgres container. Use this before switching
# apps/api-byoc/.env's DATABASE_URL between local and a real Azure Flexible
# Server -- env vars are only read once at process startup (see CLAUDE.md),
# so anything already running needs killing before it'll pick up the new
# value on the next test-dev.ps1 run.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent

function Read-DotEnv($path) {
    $vars = @{}
    if (-not (Test-Path $path)) { return $vars }
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        $key, $value = $line -split "=", 2
        $vars[$key.Trim()] = $value.Trim().Trim('"')
    }
    return $vars
}

function Stop-Port($port, $label) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-Host "$label (port $port) not running -- skipping."
        return
    }
    $ids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $ids) {
        try {
            $proc = Get-Process -Id $procId -ErrorAction Stop
            Write-Host "Stopping $label (port $port, PID $procId, $($proc.ProcessName))..."
            Stop-Process -Id $procId -Force
        } catch {
            Write-Host "Could not stop PID $procId for $label -- $_"
        }
    }
}

$apiEnv = Read-DotEnv (Join-Path $repoRoot "apps\api-byoc\.env")
$apiPort = if ($apiEnv["PORT"]) { $apiEnv["PORT"] } else { "3001" }

Write-Host "== Stopping apps/api-byoc =="
Stop-Port $apiPort "apps/api-byoc"

Write-Host "`n== Stopping apps/web =="
Stop-Port 3000 "apps/web"

Write-Host "`n== Stopping Prisma Studio =="
Stop-Port 5555 "Prisma Studio"

Write-Host "`n== Stopping local Postgres container =="
docker compose -f (Join-Path $repoRoot "docker-compose.dev.yml") stop postgres

Write-Host "`nAll stopped. Switch modes with .\dev-test\set-mode.ps1 -Mode local|azure (or edit apps/api-byoc/.env / apps/web/.env.local directly for a one-off change), then re-run test-dev.ps1." -ForegroundColor Green
