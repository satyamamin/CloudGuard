# Ensures the Azure CLI has a valid session before local Connect Azure testing.
#
# Logs in non-interactively via a Service Principal (local-dev-test/.env) ONLY if the
# current session's token has actually expired -- avoids the interactive
# `az login` re-auth normally forced by Conditional Access sign-in-frequency
# policies on personal accounts. Always finishes by selecting the target
# subscription, regardless of whether a fresh login just happened.

$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Error "local-dev-test/.env not found. Copy local-dev-test/.env.example to local-dev-test/.env and fill in real values first."
    exit 1
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $key, $value = $line -split "=", 2
    [Environment]::SetEnvironmentVariable($key, $value, "Process")
}

$appId = $env:AZURE_SP_APP_ID
$secret = $env:AZURE_SP_SECRET
$tenantId = $env:AZURE_SP_TENANT_ID
$subscription = $env:AZURE_SUBSCRIPTION

if (-not $appId -or -not $secret -or -not $tenantId) {
    Write-Error "AZURE_SP_APP_ID, AZURE_SP_SECRET, and AZURE_SP_TENANT_ID must all be set in local-dev-test/.env."
    exit 1
}

Write-Host "Checking current Azure CLI session..."
az account get-access-token --resource https://management.azure.com/ -o none 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "Session token still valid -- skipping login."
} else {
    Write-Host "Session token missing or expired -- logging in via Service Principal..."
    az login --service-principal -u $appId -p $secret --tenant $tenantId -o none
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Service Principal login failed."
        exit 1
    }
    Write-Host "Logged in as Service Principal $appId."
}

Write-Host "Selecting subscription: $subscription"
az account set --subscription $subscription
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to select subscription '$subscription'."
    exit 1
}

Write-Host "Ready -- active subscription is $subscription."
