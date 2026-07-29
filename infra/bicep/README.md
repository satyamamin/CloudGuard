# Deploy to Azure template

Provisions the v1 customer-hosted backend described in
[`docs/connect-azure.md`](../../docs/connect-azure.md): a Container App
(system-assigned Managed Identity) + Postgres Flexible Server + Reader/Cost
Management Reader role assignments, all inside the customer's own
subscription.

## Rebuilding `main.json`

`main.json` is the compiled artifact the Deploy-to-Azure link actually
points at (the Portal does not accept raw `.bicep`). Rebuild it after any
change under `infra/bicep/`:

```
az bicep build --file infra/bicep/main.bicep --outfile infra/bicep/main.json
```

Commit `main.json` — it's a deploy artifact, not a build byproduct to
discard.

## Deploy-to-Azure button URL

Once pushed to `github.com/satyamamin/CloudGuard` on `main`:

```
https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fsatyamamin%2FCloudGuard%2Fmain%2Finfra%2Fbicep%2Fmain.json
```

This requires the repo (or at least this file) to be publicly readable on
GitHub. `apps/web`'s `NEXT_PUBLIC_BICEP_TEMPLATE_URI` env var should be set
to this same raw URL (unencoded) — the frontend's deploy button builds the
encoded portal link from it.

## Validating locally

```
az bicep build --file infra/bicep/main.bicep --outfile infra/bicep/main.json
az deployment group validate \
  --resource-group <a-test-resource-group> \
  --template-file infra/bicep/main.json
```

A real end-to-end check requires an actual `az deployment group create`
against a personal/test subscription — confirms the Container App comes up,
Postgres provisions, and the Reader + Cost Management Reader role
assignments land on the Container App's Managed Identity at subscription
scope.

## Known v1 gap

An ARM/Bicep deployment `output` (the API key) is not actually ephemeral —
it stays visible in the resource group's Deployment history to anyone with
read access, unlike the "shown once" framing in `connect-azure.md`. Accepted
for v1 trial scope; revisit (rotate post-first-login, or reference a
Key Vault secret instead) before this needs to hold up under a real security
review.
