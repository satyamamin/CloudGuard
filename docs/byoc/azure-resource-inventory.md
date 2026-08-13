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
| 6 | `Microsoft.App/containerApps` | `finops-lab-api` | System-assigned Managed Identity; external ingress on port 3001; pinned `minReplicas=maxReplicas=1` (see `CLAUDE.md`'s note on why — the in-memory sync lock and migration-on-boot strategy only hold for a single replica); one container `api` running `containerImage` (default `ghcr.io/satyamamin/finops-lab-api:latest`); env vars `DATABASE_URL`/`API_KEY` (from Container App secrets), `AZURE_AUTH_MODE=managed-identity`, `FRONTEND_ORIGIN`, `PORT=3001`; `revisionSuffix` deterministically derived from `apiKey` via `uniqueString()` — forces a genuinely new revision (and real container restart) on every redeploy, since Container Apps otherwise has no reason to restart when only a secret's *value* changes (see "Redeploying" below) |

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

## Finding the Managed Identity in the Portal

A system-assigned Managed Identity isn't its own standalone resource you'd
find sitting in a resource group — it's created and destroyed automatically
alongside its parent (resource #6, the `finops-lab-api` Container App).
But Azure AD (Entra ID) does create a real Service Principal object to
represent it in the directory, which is what shows up under
**Entra ID → Enterprise Applications** (filter by **Application type =
Managed Identities** to see only these, not regular app registrations).

"Scope" means two different things here, worth not conflating:

1. **The identity object itself** isn't scoped to a resource group or
   subscription at all — it's a tenant-wide Azure AD object. What ties it
   to a specific place is which resource owns it: this one belongs to
   `rg-finops-lab-dev` → `finops-lab-api`.
2. **What it's allowed to do** — its role assignments (7a/7b above) — *is*
   genuinely scoped, and that's the whole subscription, not the resource
   group, per the reasoning above.

Fastest way to see both at once in the Portal, without going through
Enterprise Applications separately: open the Container App itself → left
sidebar **Identity** → **System assigned** tab. It shows the Object ID and
has an **"Azure role assignments"** button that lists every role this
specific identity holds across every scope in one place.

## Monitoring additional subscriptions

By default the Managed Identity only has Reader + Cost Management Reader on
the **one** subscription chosen during deployment (7a/7b above) — that's
why `GET /subscriptions` (and the "Choose which subscriptions to monitor"
step on `/connect-azure`) only ever lists one subscription right after a
fresh deployment, not a bug.

To see cost data for more subscriptions later, the customer manually grants
the **same** Managed Identity (found via the steps above) Reader + Cost
Management Reader on each additional subscription — Portal: subscription →
**Access control (IAM)** → **Add role assignment** → search for
`finops-lab-api` by name; or CLI:

```
az role assignment create --assignee <principalId> --role Reader --scope /subscriptions/<subId>
az role assignment create --assignee <principalId> --role "Cost Management Reader" --scope /subscriptions/<subId>
```

To cover many subscriptions at once instead of one at a time, the same two
roles can be assigned once at a **Management Group** scope — cascades to
every subscription under it, including ones added later. Note this needs
the customer to already have (or their Global Admin to grant via Azure AD's
one-time "Elevate access") permission at that Management Group scope,
which most subscription-level Owners won't have by default.

Either way, no redeploy and no app change is needed — the next visit to
`/connect-azure`'s subscription step just reflects whatever the identity
can currently see.

## Deployment outputs (not resources)

| Output | Value | Used for |
|---|---|---|
| `backendUrl` | `https://<finops-lab-api's-fqdn>` | Pasted into the pairing form on `/connect-azure` |
| `apiKey` | secure, auto-generated | Same — pairs the frontend with this specific deployment |

Known gap (see `infra/bicep/README.md`): these outputs are not actually
ephemeral — they remain visible in the resource group's Deployment history
to anyone with read access, despite `docs/byoc/connect-azure.md`'s "shown
once" framing. Accepted for v1 trial scope.

`apiKey`'s output is deliberately **not** `@secure()`, even though the
parameter feeding it is — found the hard way on the first real deployment.
Azure Resource Manager never returns secure output *values* through any
channel (Portal, CLI, or the raw REST API) to anyone, ever, even the
legitimate customer with full read access — marking the output secure made
it permanently unretrievable, defeating its entire purpose. Dropping
`@secure()` from just the output (not the parameter) makes the value
genuinely retrievable while it still doesn't appear in deployment
input/activity logs. This is exactly the tradeoff the paragraph above
already describes — the `@secure()` output was accidentally *stricter*
than that documented, accepted behavior, not matching it.

## Redeploying

Bicep/ARM deployments are idempotent — redeploying against the same
resource group updates resources in place rather than duplicating them.
One gotcha specific to this template: Container Apps treats secret
*values* as application-scope, not revision-scope. Env vars resolve a
`secretRef` once at container boot; updating a secret's value in the
control plane does **not** restart the running container to re-read it.
Since nothing else changes on a routine redeploy (same image tag, same env
var names), Container Apps would otherwise have no reason to ever create a
new revision — every redeploy would be silently a no-op on the actually-
running container, serving stale secrets (a freshly-rotated `apiKey`
included) indefinitely. `revisionSuffix` (resource #6 above) exists
specifically to force a real restart on every deploy, regardless of
whether anything revision-scope actually changed.

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
