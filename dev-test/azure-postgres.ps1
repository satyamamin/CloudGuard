# Shared helpers for starting/stopping the Azure Postgres Flexible Server used
# by "azure" mode, dot-sourced by test-dev.ps1 and stop-dev.ps1.
#
# Why this exists: Azure Database for PostgreSQL Flexible Server has NO
# serverless / auto-pause tier -- unlike the Container App (which is set to
# minReplicas=0 and genuinely scales to zero on its own), the database only
# stops when something explicitly stops it. Leaving it running costs roughly
# $12/month in compute for a dev box nobody is using. So: test-dev.ps1 starts
# it on demand, stop-dev.ps1 stops it when you're done.
#
# Two things worth knowing before relying on this:
#   1. Azure force-restarts a stopped Flexible Server after 7 days. You cannot
#      opt out, so this is cost control, not a permanent off switch.
#   2. While it's stopped, the deployed Container App can't reach a database,
#      so the live frontend (cloud-guard-web.vercel.app) returns errors on
#      /status and every /costs/* view. That's the accepted trade-off.
#
# Storage is billed whether the server runs or not -- only compute stops.

# Resolves the Azure Flexible Server named by a DATABASE_URL, or $null if that
# URL isn't an Azure one (local Postgres container, etc.).
function Get-AzurePostgresTarget($databaseUrl) {
    if (-not $databaseUrl) { return $null }
    if ($databaseUrl -notmatch '@([^:/,]+)\.postgres\.database\.azure\.com') { return $null }
    $serverName = $Matches[1]

    $rg = az postgres flexible-server list --query "[?name=='$serverName'].resourceGroup | [0]" -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $rg) {
        Write-Host "  Could not locate Flexible Server '$serverName' in the current subscription -- skipping." -ForegroundColor Yellow
        return $null
    }
    return @{ Name = $serverName; ResourceGroup = $rg.Trim() }
}

function Get-AzurePostgresState($target) {
    $state = az postgres flexible-server show -g $target.ResourceGroup -n $target.Name --query state -o tsv 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return $state.Trim()
}

# Distinguishes "you lack the rights" from a genuine failure. ensure-az-login.ps1
# keeps an existing valid session and only falls back to the read-only Service
# Principal when the token has expired -- and that SP can read the server but
# cannot start/stop it, so this is a realistic outcome, not a corner case.
function Write-AzurePostgresAuthHint($action, $target) {
    Write-Host ""
    Write-Host "  Not authorized to $action '$($target.Name)'." -ForegroundColor Yellow
    Write-Host "  The active Azure identity is probably the read-only Service Principal from" -ForegroundColor Yellow
    Write-Host "  dev-test/.env (ensure-az-login.ps1 falls back to it once your own token expires)." -ForegroundColor Yellow
    Write-Host "  Fix: run 'az login' as yourself, then re-run this script." -ForegroundColor Yellow
}

function Start-AzurePostgresIfStopped($databaseUrl) {
    $target = Get-AzurePostgresTarget $databaseUrl
    if (-not $target) { return }

    $state = Get-AzurePostgresState $target
    if (-not $state) {
        Write-Host "  Could not read state for '$($target.Name)' -- skipping." -ForegroundColor Yellow
        return
    }

    if ($state -eq "Ready") {
        Write-Host "  Azure Postgres '$($target.Name)' already running -- skipping."
        return
    }

    Write-Host "  Azure Postgres '$($target.Name)' is '$state' -- starting (takes 1-2 min)..."
    $output = az postgres flexible-server start -g $target.ResourceGroup -n $target.Name -o none 2>&1
    if ($LASTEXITCODE -ne 0) {
        if ("$output" -match "AuthorizationFailed") { Write-AzurePostgresAuthHint "start" $target }
        else { Write-Host "  Failed to start '$($target.Name)': $output" -ForegroundColor Yellow }
        return
    }
    Write-Host "  Azure Postgres '$($target.Name)' is running." -ForegroundColor Green
}

function Stop-AzurePostgresIfRunning($databaseUrl) {
    $target = Get-AzurePostgresTarget $databaseUrl
    if (-not $target) { return }

    $state = Get-AzurePostgresState $target
    if (-not $state) {
        Write-Host "  Could not read state for '$($target.Name)' -- skipping." -ForegroundColor Yellow
        return
    }

    if ($state -ne "Ready") {
        Write-Host "  Azure Postgres '$($target.Name)' already '$state' -- skipping."
        return
    }

    Write-Host "  Stopping Azure Postgres '$($target.Name)' (saves ~`$12/mo compute; storage still bills)..."
    $output = az postgres flexible-server stop -g $target.ResourceGroup -n $target.Name -o none 2>&1
    if ($LASTEXITCODE -ne 0) {
        if ("$output" -match "AuthorizationFailed") { Write-AzurePostgresAuthHint "stop" $target }
        else { Write-Host "  Failed to stop '$($target.Name)': $output" -ForegroundColor Yellow }
        return
    }
    Write-Host "  Azure Postgres '$($target.Name)' stopped. Azure will force-restart it after 7 days." -ForegroundColor Green
}
