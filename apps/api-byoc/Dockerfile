# Multi-stage build for the Container App image deployed into the
# customer's own Azure tenant (see infra/bicep and docs/connect-azure.md).

FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api-byoc/package.json apps/api-byoc/package.json
RUN npm install --workspaces --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api-byoc apps/api-byoc

RUN npm run build -w packages/shared
RUN npx prisma generate --schema apps/api-byoc/prisma/schema.prisma
RUN npm run build -w apps/api-byoc

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/shared/dist ./node_modules/@finops-lab/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./node_modules/@finops-lab/shared/package.json
COPY --from=builder /repo/apps/api-byoc/node_modules ./apps/api-byoc/node_modules
COPY --from=builder /repo/apps/api-byoc/dist ./apps/api-byoc/dist
COPY --from=builder /repo/apps/api-byoc/prisma ./apps/api-byoc/prisma
COPY --from=builder /repo/apps/api-byoc/package.json ./apps/api-byoc/package.json
COPY apps/api-byoc/docker-entrypoint.sh ./apps/api-byoc/docker-entrypoint.sh

WORKDIR /app/apps/api-byoc
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
