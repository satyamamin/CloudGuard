# Switches apps/api-byoc/.env and apps/web/.env.local between two complete,
# pre-built profiles -- .env.dev-local / .env.dev-azure alongside each app's
# real .env file. Replaces hand-editing comment/uncomment pairs across two
# files for every switch (DATABASE_URL, USE_MOCK_COST_DATA, Clerk keys).
#
# Usage: .\dev-test\set-mode.ps1 -Mode local
#        .\dev-test\set-mode.ps1 -Mode azure
#        .\dev-test\set-mode.ps1 -Mode azure -NoRestart   # only swap the files
#
# If apps/api-byoc and apps/web are both already running AND already
# reflect the requested mode's exact config (checked by content, not just
# "is it running"), this is a no-op -- nothing is copied and nothing is
# restarted. Otherwise it swaps the files, then -- unless -NoRestart is
# passed -- runs stop-dev.ps1 then test-dev.ps1 to bring everything back up
# cleanly under the new mode (env vars are only read at process startup, so
# a live process would otherwise keep serving under the old mode
# indefinitely).

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("local", "azure")]
    [string]$Mode,

    [switch]$NoRestart
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent

$apiEnvPath = Join-Path $repoRoot "apps\api-byoc\.env"
$webEnvPath = Join-Path $repoRoot "apps\web\.env.local"
$apiTemplatePath = Join-Path $repoRoot "apps\api-byoc\.env.dev-$Mode"
$webTemplatePath = Join-Path $repoRoot "apps\web\.env.dev-$Mode"

foreach ($path in @($apiTemplatePath, $webTemplatePath)) {
    if (-not (Test-Path $path)) {
        Write-Error "Template not found: $path"
        exit 1
    }
}

function Test-SameContent($pathA, $pathB) {
    if (-not (Test-Path $pathA)) { return $false }
    return (Get-Content $pathA -Raw) -eq (Get-Content $pathB -Raw)
}

$apiRunning = [bool](Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue)
$webRunning = [bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
$apiAlreadyThisMode = Test-SameContent $apiEnvPath $apiTemplatePath
$webAlreadyThisMode = Test-SameContent $webEnvPath $webTemplatePath

if ($apiRunning -and $webRunning -and $apiAlreadyThisMode -and $webAlreadyThisMode) {
    Write-Host "Already running in '$Mode' mode -- nothing to do." -ForegroundColor Green
    exit 0
}

Write-Host "Switching to '$Mode' mode..." -ForegroundColor Cyan

Copy-Item -Path $apiTemplatePath -Destination $apiEnvPath -Force
Write-Host "  $apiEnvPath <- $(Split-Path $apiTemplatePath -Leaf)"

Copy-Item -Path $webTemplatePath -Destination $webEnvPath -Force
Write-Host "  $webEnvPath <- $(Split-Path $webTemplatePath -Leaf)"

if ($NoRestart) {
    Write-Host "`nDone. -NoRestart passed -- files swapped only, nothing restarted." -ForegroundColor Green
    exit 0
}

if ($apiRunning -or $webRunning) {
    Write-Host "`napps/api-byoc or apps/web is still running under the old mode -- restarting..." -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "stop-dev.ps1")
    Write-Host ""
    & (Join-Path $PSScriptRoot "test-dev.ps1")
} else {
    Write-Host "`nDone. Nothing was running, so nothing to restart -- run .\dev-test\test-dev.ps1 whenever you're ready." -ForegroundColor Green
}
