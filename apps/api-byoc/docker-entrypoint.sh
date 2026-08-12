#!/bin/sh
set -euo pipefail

# Runs at container start rather than in CI, because each customer's Postgres
# is a brand-new instance created by the Bicep template — there is no
# pipeline that reaches into the customer's tenant to run this beforehand.
# Safe under v1's minReplicas=maxReplicas=1 constraint (see infra/bicep);
# do not scale this Container App beyond 1 replica without moving this to a
# proper init step first (concurrent `migrate deploy` calls race).
npx prisma migrate deploy --schema prisma/schema.prisma

exec node dist/main.js
