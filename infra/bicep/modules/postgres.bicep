// Azure Database for PostgreSQL Flexible Server — Burstable tier.
// Right-sized for a trial, not the eventual production tier (see
// docs/connect-azure.md — deferred deliberately).
param serverName string
param location string
param administratorLogin string
@secure()
param administratorLoginPassword string

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// The Container App's outbound IP isn't known ahead of deployment, so this
// allows Azure-internal traffic (the Container App included) to reach the
// server. Tightened to the Container App's specific egress IPs is a
// production-tier hardening step, not a v1 requirement.
resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgres
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgres
  name: 'cloudguard'
}

output fqdn string = postgres.properties.fullyQualifiedDomainName
