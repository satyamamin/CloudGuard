#!/usr/bin/env bash
# Intègre les tests + workflows dans le dépôt CloudGuard / FinOps Lab.
# Usage : depuis la racine du dépôt, après avoir décompressé le zip dessus :
#     bash apply.sh
# Idempotent : peut être relancé sans risque.
set -euo pipefail

[ -f package.json ] && grep -q '"name": "finops-lab"' package.json \
  || { echo "✗ Lancez ce script depuis la racine du dépôt (package.json « finops-lab » introuvable)."; exit 1; }

echo "▸ 1/5 Installation des dépendances de base (npm install)…"
[ -d node_modules ] || npm install --no-audit --no-fund

# @nestjs/testing doit avoir la même version majeure que @nestjs/common,
# sinon npm échoue (ERESOLVE : peer dependency).
NEST_MAJOR="$(node -p "require('./node_modules/@nestjs/common/package.json').version.split('.')[0]")"

echo "▸ 2/5 Dépendances de test…"
npm install -D -w apps/api-byoc --no-audit --no-fund \
  jest@29 @types/jest@29 @swc/core @swc/jest "@nestjs/testing@^${NEST_MAJOR}" supertest @types/supertest
npm install -D -w packages/shared --no-audit --no-fund vitest

echo "▸ 3/5 Scripts npm…"
npm pkg set "scripts.test=jest" "scripts.test:cov=jest --coverage" -w apps/api-byoc
npm pkg set "scripts.test=vitest run" -w packages/shared
npm pkg set "scripts.test=npm run test --workspaces --if-present"

echo "▸ 4/5 tsconfig : types node + jest (TypeScript 6 n'inclut plus les @types automatiquement)…"
TS=apps/api-byoc/tsconfig.json
if ! grep -q '"types"' "$TS"; then
  sed -i 's|"rootDir": "src"|"rootDir": "src",\n    "types": ["node", "jest"]|' "$TS"
fi

echo "▸ 5/5 .gitignore : coverage/…"
grep -qx 'coverage/' .gitignore || printf '\n# Rapports de couverture des tests\ncoverage/\n' >> .gitignore

echo
echo "✓ Terminé. Lancez : npm test"
echo "  Puis relisez les changements : git status && git diff"
