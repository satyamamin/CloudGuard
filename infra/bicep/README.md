# Deploy to Azure template

Provisions the v1 customer-hosted backend described in
[`docs/byoc/connect-azure.md`](../../docs/byoc/connect-azure.md): a Container App
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

## Releasing a new image version

`.github/workflows/build-api-image.yml` pushes `:latest` + `:<commit-sha>`
on every push to `main` — fine for local iteration, but not something to
point `containerImage`'s default at forever, since it means "whatever the
most recent main commit happened to be," not "a version someone verified
works." To cut an actual release:

1. Make sure `main` is what you want to ship, then tag and push it:
   ```
   git tag v1.2.0
   git push origin v1.2.0
   ```
   This triggers the same workflow, which additionally tags and pushes
   `ghcr.io/satyamamin/finops-lab-api:1.2.0` (the CI strips the leading `v`
   — standard Docker convention).
2. Smoke-test the new image before trusting it — point
   `apps/api-byoc/scripts/smoke-test.mjs` (`npm run smoke-test -w apps/api-byoc`)
   at a real instance running it (the `rg-finops-lab-dev` test deployment is
   the obvious target — update its Container App's image to the new tag
   first via `az containerapp update --image ...`, same stale-revision
   caveat as any other redeploy applies).
3. Once it passes, update `containerImage`'s default in `main.bicep` to the
   new pinned tag, rebuild `main.json` (see above), commit, and push — from
   that point on, new customers deploying via the button get the version
   you actually tested, not an untested moving target.
4. Existing customers stay on whatever they already deployed (Container
   Apps doesn't auto-update) — rolling out a fix to them means asking them
   to re-run the deployment against the new template, there's no push
   mechanism today.

Rolling back is the same shape in reverse: if a version misbehaves, point
`containerImage` back at the last known-good tag (or hand it directly to an
affected customer to override in their own re-deploy) — this is the entire
reason to tag releases instead of only ever building `:latest`.

## Known v1 gap

An ARM/Bicep deployment `output` (the API key) is not actually ephemeral —
it stays visible in the resource group's Deployment history to anyone with
read access, unlike the "shown once" framing in `connect-azure.md`. Accepted
for v1 trial scope; revisit (rotate post-first-login, or reference a
Key Vault secret instead) before this needs to hold up under a real security
review.
