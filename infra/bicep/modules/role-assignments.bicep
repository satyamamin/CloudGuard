// Grants Reader + Cost Management Reader to the Container App's Managed
// Identity, scoped to the subscription the customer is deploying into.
//
// This must run at subscription scope even though main.bicep deploys at
// resource-group scope (all the Azure Portal's "custom template" deployment
// blade allows) — Bicep lets a module declare a different `scope` than its
// parent deployment, which is what makes this possible from within an
// RG-scoped template.
targetScope = 'subscription'

param principalId string

var readerRoleId = 'acdd72a7-3385-48ef-bd42-f606fba81ae7'
var costManagementReaderRoleId = '72fafb9e-0641-4937-9268-a91bfd8191a3'

resource readerAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, principalId, readerRoleId)
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', readerRoleId)
  }
}

resource costManagementReaderAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, principalId, costManagementReaderRoleId)
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', costManagementReaderRoleId)
  }
}
