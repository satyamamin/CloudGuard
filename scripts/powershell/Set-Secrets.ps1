<#
.SYNOPSIS
    Pushes secrets to Azure Key Vault — adapt per project.
.PARAMETER Env
    Target environment: dev, staging, prod
.EXAMPLE
    .\Set-Secrets.ps1 -Env dev
#>
param(
    [ValidateSet("dev","staging","prod")]
    [string]$Env = "dev"
)

Write-Host "Setting secrets for: $Env" -ForegroundColor Cyan

# Example:
# az keyvault secret set --vault-name "kv-myproject-$Env" --name "MySecret" --value "value"
