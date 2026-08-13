# Azure resource inventory — what "Deploy to Azure" actually provisions

Reference doc: every Azure resource `infra/bicep/main.bicep` and its 4
modules create inside a customer's tenant when they click Deploy to Azure,
with names and key properties. Verified directly against the Bicep source,
not from memory — re-check against the actual `.bicep` files if this drifts.

## Resource-group-scoped resources

Created inside whichever resource group the customer picks (or creates)
in the Portal blade — `rg-<name>` in the examples below, using the
`environmentName` parameter's default value `finops-lab`.

| # | Resource type | Name | Key properties |
|---|---|---|---|
| 1 | `Microsoft.OperationalInsights/workspaces` (Log Analytics) | `finops-lab-env-logs` | SKU `PerGB2018`, 30-day retention |
| 2 | `Microsoft.App/managedEnvironments` (Container Apps Environment) | `finops-lab-env` | Logs to resource #1 via Log Analytics |
| 3 | `Microsoft.DBforPostgreSQL/flexibleServers` | `finops-lab-pg-<hash>` (hash from `uniqueString(resourceGroup().id)`, not knowable before deploy) | Burstable `Standard_B1ms`, Postgres 16, 32GB storage, 7-day backup retention, no geo-redundancy, high availability disabled, admin login `finopslab`, admin password auto-generated |
| 4 | `Microsoft.DBforPostgreSQL/flexibleServers/firewallRules` | `AllowAllAzureServicesAndResourcesWithinAzureIps` | `0.0.0.0`–`0.0.0.0` — Azure's special-case range meaning "any Azure-internal service," not the literal internet |
| 5 | `Microsoft.DBforPostgreSQL/flexibleServers/databases` | `finopslab` | The actual database inside resource #3 |
| 6 | `Microsoft.App/containerApps` | `finops-lab-api` | System-assigned Managed Identity; external ingress on port 3001; pinned `minReplicas=maxReplicas=1` (see `CLAUDE.md`'s note on why — the in-memory sync lock and migration-on-boot strategy only hold for a single replica); one container `api` running `containerImage` (default `ghcr.io/satyamamin/finops-lab-api:latest`); env vars `DATABASE_URL`/`API_KEY` (from Container App secrets), `AZURE_AUTH_MODE=managed-identity`, `FRONTEND_ORIGIN`, `PORT=3001` |

## Subscription-scoped resources

Created at the **subscription** level, not inside the resource group —
`modules/role-assignments.bicep` declares `targetScope = 'subscription'`
and `main.bicep` invokes it with an explicit `scope: subscription()`, even
though the rest of the template is resource-group scoped (the only scope
the Portal's "custom template" deploy blade allows). This is why deploying
requires **Owner** or **User Access Administrator** on the subscription —
Contributor alone can't create role assignments, and the deployment fails
partway through without it.

| # | Resource type | Grants | Scope | Principal |
|---|---|---|---|---|
| 7a | `Microsoft.Authorization/roleAssignments` | **Reader** | Whole subscription | Resource #6's Managed Identity |
| 7b | `Microsoft.Authorization/roleAssignments` | **Cost Management Reader** | Whole subscription | Same |

Subscription-wide (not resource-group-scoped) because Cost Management data
is queried at the subscription level, not per-resource-group.

## Deployment outputs (not resources)

| Output | Value | Used for |
|---|---|---|
| `backendUrl` | `https://<finops-lab-api's-fqdn>` | Pasted into the pairing form on `/connect-azure` |
| `apiKey` | secure, auto-generated | Same — pairs the frontend with this specific deployment |

Known gap (see `infra/bicep/README.md`): these outputs are not actually
ephemeral — they remain visible in the resource group's Deployment history
to anyone with read access, despite `docs/byoc/connect-azure.md`'s "shown
once" framing. Accepted for v1 trial scope.

## `apiKey` vs. `postgresAdminPassword` — two separate secrets, don't confuse them

The Portal form shows both as auto-generated secure fields next to each
other, which makes them easy to conflate. They are independently
generated and do completely different jobs:

| | `apiKey` | `postgresAdminPassword` |
|---|---|---|
| Default | `newGuid()` | `'Cg' + uniqueString(resourceGroup().id, deployment().name) + newGuid()` |
| Authenticates | Your **frontend to the backend API** — the `Authorization: Bearer <key>` header, checked by `src/auth/api-key.guard.ts` | The **backend to its own Postgres database** |
| Exposed as a deployment output? | **Yes** — `output apiKey string = apiKey` | **No** — never surfaced anywhere |
| What you do with it | Copy it and paste it into the pairing form on `/connect-azure`, along with `backendUrl` | Nothing — it only ever exists baked into the `DATABASE_URL` connection string injected as a Container App secret (see resource #6 above); you never see or handle it directly |

Practical takeaway: leave both as their auto-generated defaults in the
Portal form, but only `apiKey` is something you'll actually use in the
next step. `postgresAdminPassword` is one you'll never touch again.

## What's deliberately *not* here

No storage accounts, no Key Vault, no networking resources beyond the one
firewall rule above. `apiKey` and `postgresAdminPassword` are marked
`@secure()` params in `main.bicep` but are not pulled from Key Vault —
see the known-gap note above.
