// The backend API Container App. System-assigned Managed Identity is what
// lets it authenticate to Cost Management / Resource Graph with no stored
// credential at all (see docs/byoc/connect-azure.md).
param name string
param location string
param environmentId string
param containerImage string
@secure()
param databaseUrl string
@secure()
param apiKey string
param frontendOrigin string

// Container Apps treats secret *values* as application-scope, not
// revision-scope -- env vars resolve a secretRef once at container boot,
// so updating a secret's value on redeploy does NOT restart the running
// container to pick it up (confirmed empirically: a redeploy that
// rotated apiKey left the original revision, and its original apiKey,
// serving 100% of traffic). A caller-supplied suffix that changes every
// deployment forces Container Apps to create a fresh revision -- and
// therefore a real restart -- every time, regardless of whether anything
// revision-scope (like the image tag) actually changed.
param revisionSuffix string

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: environmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 3001
        transport: 'auto'
      }
      secrets: [
        { name: 'database-url', value: databaseUrl }
        { name: 'api-key', value: apiKey }
      ]
    }
    template: {
      revisionSuffix: revisionSuffix
      // Pinned to exactly 1 replica for v1: Prisma migrations run from the
      // container's own entrypoint at startup (docker-entrypoint.sh), and
      // concurrent `migrate deploy` calls across replicas would race. Also
      // matches the in-memory sync re-entrancy lock in apps/api-byoc's SyncService,
      // which only holds correctly for a single running instance.
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
      containers: [
        {
          name: 'api'
          image: containerImage
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'API_KEY', secretRef: 'api-key' }
            { name: 'AZURE_AUTH_MODE', value: 'managed-identity' }
            { name: 'FRONTEND_ORIGIN', value: frontendOrigin }
            { name: 'PORT', value: '3001' }
          ]
        }
      ]
    }
  }
}

output principalId string = containerApp.identity.principalId
output fqdn string = containerApp.properties.configuration.ingress.fqdn
