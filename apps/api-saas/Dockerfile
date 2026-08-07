# Multi-stage build for apps/api-saas — the SaaS tier's centrally-hosted,
# multi-tenant backend (Railway/Neon). Unlike apps/api's BYOC image, this one
# does NOT run `prisma migrate deploy` at container boot: Neon is a
# persistent, shared database and Railway gives no guarantee of a single
# replica the way Bicep's minReplicas=maxReplicas=1 does for BYOC, so
# migrations run as a release-phase CI step instead (see
# docs/cloudguard-hosted.md). This image only runs the compiled server.

FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api-saas/package.json apps/api-saas/package.json
RUN npm install --workspaces --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api-saas apps/api-saas

RUN npm run build -w packages/shared
RUN npx prisma generate --schema apps/api-saas/prisma/schema.prisma
RUN npm run build -w apps/api-saas

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/shared/dist ./node_modules/@cloudguard/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./node_modules/@cloudguard/shared/package.json
COPY --from=builder /repo/apps/api-saas/node_modules ./apps/api-saas/node_modules
COPY --from=builder /repo/apps/api-saas/dist ./apps/api-saas/dist
COPY --from=builder /repo/apps/api-saas/prisma ./apps/api-saas/prisma
COPY --from=builder /repo/apps/api-saas/package.json ./apps/api-saas/package.json

WORKDIR /app/apps/api-saas
EXPOSE 3002
CMD ["node", "dist/main.js"]
