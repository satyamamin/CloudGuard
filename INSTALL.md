# Kit tests + workflows GitHub — CloudGuard / FinOps Lab

## Installation (2 minutes)

```bash
cd CloudGuard                      # racine du dépôt, sur une branche dédiée
git switch -c chore/tests-ci
unzip -o ../cloudguard-tests-kit.zip -d .
bash apply.sh                      # dépendances, scripts npm, tsconfig, .gitignore
npm test                           # 58 tests Jest + 21 tests Vitest attendus
rm apply.sh INSTALL.md             # ne pas les committer
git add -A && git commit -m "Add unit tests and CI hardening"
git push -u origin chore/tests-ci  # ouvrir la PR : la CI se lance
```

`unzip -o` écrase trois fichiers existants : `.github/workflows/ci.yml`,
`.github/workflows/build-api-image.yml` et `apps/api-byoc/tsconfig.build.json`.
Relisez-les avec `git diff` avant de committer.

## Contenu

| Élément | Rôle |
|---|---|
| `apps/api-byoc/jest.config.js` | Jest + SWC (décorateurs NestJS), mappe `@finops-lab/shared` sur ses sources : pas besoin de build ni de `prisma generate` pour tester |
| 7 fichiers `*.spec.ts` (58 tests) | Guard API key (+ e2e), mapping 429 Azure, parsing Cost Management + cache, verrou de sync, DTO/ValidationPipe, filtre 503 |
| `packages/shared/test/*` (21 tests, 3 `todo`) | Contrats Zod, `maskApiKey`, pairing. Les `todo` listent le durcissement SSRF de `backendUrl` à venir |
| `tsconfig.build.json` | Exclut `*.spec.ts` et `jest.config.js` de `nest build` |
| `ci.yml` | Jobs `tests`, `build-and-lint`, `docker-build`, `bicep-in-sync`, `audit` (informatif) |
| `build-api-image.yml` | N'appelle la publication GHCR qu'après succès de `ci.yml` |

## À faire côté GitHub (une fois)

Settings → Branches → règle pour `main` → « Require status checks to pass » :
`tests`, `build-and-lint`, `docker-build`, `bicep-in-sync`. Sans cela, la CI est informative.

## Points d'attention

- `ci.yml` n'a plus de déclencheur `push: main` : le push sur main passe par
  `build-api-image.yml` qui l'appelle (évite une double exécution).
- `audit` est en `continue-on-error`. Retirez cette ligne quand les alertes sont traitées.
- Le job `bicep-in-sync` ignore les blocs `_generator` (version du compilateur).
- Les dépendances de test alourdissent `node_modules` d'environ 190 Mo, et le
  Dockerfile copie tout `node_modules` dans l'image finale.
