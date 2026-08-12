// "Deploy to Azure" template for FinOps Lab (v1 — customer-hosted).
// Provisions a single-tenant backend + database directly inside the
// customer's own Azure subscription. See docs/byoc/connect-azure.md for the
// full architecture rationale.
//
// Deployed at resource-group scope (the only scope the Azure Portal's
// custom-template "Deploy a custom template" flow supports); the role
// assignment module below elevates to subscription scope internally.
targetScope = 'resourceGroup'

@description('Prefix used to name all provisioned resources.')
param environmentName string = 'finops-lab'

@description('Region for all resources. Restrict to EU regions in the portal UI to match the GDPR/data-residency pitch.')
param location string = resourceGroup().location

@description('Container image for the backend API. Defaults to the public GHCR image built from apps/api-byoc/Dockerfile.')
param containerImage string = 'ghcr.io/satyamamin/finops-lab-api:latest'

@description('Origin of the FinOps Lab frontend allowed to call this backend (CORS).')
param frontendOrigin string = 'https://finops-lab.vercel.app'

@secure()
@description('Shown once as a deployment output; the customer pastes it into the FinOps Lab frontend to pair. NOTE: Azure deployment outputs remain visible in this resource group\'s Deployment history to anyone with read access — accepted as a v1 trial-scope tradeoff, see docs/byoc/connect-azure.md.')
param apiKey string = newGuid()

@secure()
param postgresAdminPassword string = 'Cg${uniqueString(resourceGroup().id, deployment().name)}${newGuid()}'

var postgresAdminLogin = 'finopslab'
var postgresServerName = '${environmentName}-pg-${uniqueString(resourceGroup().id)}'
var containerAppEnvName = '${environmentName}-env'
var containerAppName = '${environmentName}-api'

module containerAppsEnv 'modules/container-apps-env.bicep' = {
  name: 'containerAppsEnv'
  params: {
    name: containerAppEnvName
    location: location
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    serverName: postgresServerName
    location: location
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
  }
}

module containerApp 'modules/container-app.bicep' = {
  name: 'containerApp'
  params: {
    name: containerAppName
    location: location
    environmentId: containerAppsEnv.outputs.id
    containerImage: containerImage
    databaseUrl: 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${postgres.outputs.fqdn}:5432/finopslab?sslmode=require'
    apiKey: apiKey
    frontendOrigin: frontendOrigin
  }
}

// Deployed with an explicit subscription scope even though this template is
// resource-group scoped overall — see modules/role-assignments.bicep for why.
module roleAssignments 'modules/role-assignments.bicep' = {
  name: 'roleAssignments'
  scope: subscription()
  params: {
    principalId: containerApp.outputs.principalId
  }
}

@description('Deployment output: paste into FinOps Lab\'s frontend along with the API key to pair.')
output backendUrl string = 'https://${containerApp.outputs.fqdn}'

@secure()
output apiKey string = apiKey
