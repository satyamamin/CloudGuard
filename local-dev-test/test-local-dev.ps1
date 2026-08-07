# One-shot local dev startup for Connect Azure testing (README.md "Restarting
# local dev" steps 1-6). Idempotent: safe to re-run — skips anything that's
# already running instead of spawning duplicate processes/terminals.

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

function Wait-ForHttp($url, $headers, $label, $timeoutSec = 60) {
    $elapsed = 0
    while ($elapsed -lt $timeoutSec) {
        try {
            if ($headers) { Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 3 | Out-Null }
            else { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null }
            return $true
        } catch {
            Start-Sleep -Seconds 2
            $elapsed += 2
        }
    }
    Write-Error "$label did not become ready within ${timeoutSec}s."
    return $false
}

# Step 1 — Azure CLI session
Write-Host "== Step 1: Azure CLI session ==" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "ensure-az-login.ps1")

# Step 2 — Docker + local Postgres
Write-Host "`n== Step 2: Docker / Postgres ==" -ForegroundColor Cyan
docker info -f "{{.ServerVersion}}" *> $null
if ($LASTEXITCODE -ne 0) {
    $dockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path $dockerDesktopExe)) {
        Write-Error "Docker Desktop isn't running and wasn't found at '$dockerDesktopExe'. Start it manually, then re-run this script."
        exit 1
    }
    Write-Host "Docker Desktop isn't running — starting it..."
    Start-Process $dockerDesktopExe

    $elapsed = 0
    $timeoutSec = 120
    while ($LASTEXITCODE -ne 0 -and $elapsed -lt $timeoutSec) {
        Start-Sleep -Seconds 5
        $elapsed += 5
        docker info -f "{{.ServerVersion}}" *> $null
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker Desktop didn't become ready within ${timeoutSec}s. Check it manually, then re-run this script."
        exit 1
    }
    Write-Host "Docker Desktop is ready."
}
docker compose -f (Join-Path $repoRoot "docker-compose.dev.yml") up -d postgres

# Step 3 — apps/api
Write-Host "`n== Step 3: apps/api ==" -ForegroundColor Cyan
$apiEnv = Read-DotEnv (Join-Path $repoRoot "apps\api\.env")
$apiPort = if ($apiEnv["PORT"]) { $apiEnv["PORT"] } else { "3001" }
$apiKey = $apiEnv["API_KEY"]
$apiHealthUrl = "http://localhost:$apiPort/health"
$apiHeaders = @{ Authorization = "Bearer $apiKey" }

$apiAlreadyUp = $false
try {
    $health = Invoke-RestMethod -Uri $apiHealthUrl -Headers $apiHeaders -TimeoutSec 3
    $apiAlreadyUp = $true
} catch {}

if ($apiAlreadyUp) {
    Write-Host "apps/api already running on port $apiPort — skipping."
} else {
    # apps/api has no dotenv loading of its own (see apps/api/src/main.ts) —
    # `nest start` does not read .env files automatically. Without this, the
    # spawned process crashes at boot with "Environment variable not found:
    # DATABASE_URL" (PrismaService.onModuleInit), even though $apiEnv above
    # already parsed the exact values needed — they were only ever used for
    # this script's own health-check polling, never forwarded to the child.
    $envSetters = ($apiEnv.GetEnumerator() | ForEach-Object {
        $value = $_.Value -replace "'", "''"
        "`$env:$($_.Key) = '$value'"
    }) -join "; "
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repoRoot'; $envSetters; npm run dev:api"
    Write-Host "Waiting for apps/api to become healthy..."
    if (-not (Wait-ForHttp $apiHealthUrl $apiHeaders "apps/api")) { exit 1 }
    $health = Invoke-RestMethod -Uri $apiHealthUrl -Headers $apiHeaders -TimeoutSec 3
}
Write-Host "apps/api healthy at $apiHealthUrl" -ForegroundColor Green

# Step 4 — apps/web
Write-Host "`n== Step 4: apps/web ==" -ForegroundColor Cyan
$webUrl = "http://localhost:3000"

$webAlreadyUp = $false
try { Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 3 | Out-Null; $webAlreadyUp = $true } catch {}

if ($webAlreadyUp) {
    Write-Host "apps/web already running on port 3000 — skipping."
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repoRoot'; npm run dev:web"
    Write-Host "Waiting for apps/web to become ready..."
    if (-not (Wait-ForHttp $webUrl $null "apps/web")) { exit 1 }
}
Write-Host "apps/web ready at $webUrl" -ForegroundColor Green

# Step 5 — sanity-check (reuses the health check from step 3 instead of re-querying if already up)
Write-Host "`n== Step 5: sanity check ==" -ForegroundColor Cyan
if ($apiAlreadyUp) {
    Write-Host "Already confirmed healthy in step 3 — skipping recheck."
}
Write-Host "apps/api /health -> $($health | ConvertTo-Json -Compress)" -ForegroundColor Green

# Step 6 — open in browser (reuses an already-open Chrome window/tab if one exists)
Write-Host "`n== Step 6: opening browser ==" -ForegroundColor Cyan
Start-Process "chrome" "$webUrl/connect-azure"

Write-Host "`nAll set." -ForegroundColor Green
