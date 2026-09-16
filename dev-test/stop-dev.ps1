# Stops everything test-dev.ps1 starts: apps/api-byoc, apps/web, Prisma
# Studio, and the local Postgres container. Use this before switching
# apps/api-byoc/.env's DATABASE_URL between local and a real Azure Flexible
# Server -- env vars are only read once at process startup (see CLAUDE.md),
# so anything already running needs killing before it'll pick up the new
# value on the next test-dev.ps1 run.

param(
    # Skips stopping the Azure Postgres Flexible Server. set-mode.ps1 passes
    # this when switching INTO azure mode, where it calls stop-dev.ps1 only to
    # kill the old processes and is about to need the database up again.
    [switch]$KeepDatabase
)

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
# Gated on Docker actually running -- in azure mode there's no local container
# to stop, and an unguarded `docker compose` here would spin up / error out of
# Docker Desktop for nothing.
docker info -f "{{.ServerVersion}}" *> $null
if ($LASTEXITCODE -eq 0) {
    docker compose -f (Join-Path $repoRoot "docker-compose.dev.yml") stop postgres
} else {
    Write-Host "Docker isn't running -- no local Postgres container to stop."
}

Write-Host "`n== Stopping Azure Postgres =="
if ($KeepDatabase) {
    Write-Host "-KeepDatabase passed -- leaving the Flexible Server running."
} else {
    # Deliberately read .env.dev-azure, NOT the live .env. set-mode.ps1 swaps
    # .env BEFORE calling this script, so by the time we run, .env already
    # describes the mode being switched TO. Reading it would mean that
    # switching azure -> local never stops the server (the exact case where
    # you want it off), while local -> azure would stop the server it is about
    # to start. .env.dev-azure names the one Azure dev server either way.
    . (Join-Path $PSScriptRoot "azure-postgres.ps1")
    $azureEnv = Read-DotEnv (Join-Path $repoRoot "apps\api-byoc\.env.dev-azure")
    if ($azureEnv["DATABASE_URL"]) {
        Stop-AzurePostgresIfRunning $azureEnv["DATABASE_URL"]
    } else {
        Write-Host "No DATABASE_URL in apps/api-byoc/.env.dev-azure -- nothing to stop."
    }
}

Write-Host "`nAll stopped. Switch modes with .\dev-test\set-mode.ps1 -Mode local|azure (or edit apps/api-byoc/.env / apps/web/.env.local directly for a one-off change), then re-run test-dev.ps1." -ForegroundColor Green
