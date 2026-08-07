-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING_CONSENT', 'PENDING_ROLE_ASSIGNMENT', 'ACTIVE', 'ERROR', 'REVOKED');

-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "azure_connection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "azureTenantId" TEXT NOT NULL,
    "consentGrantedAt" TIMESTAMP(3),
    "roleAssignmentConfirmedAt" TIMESTAMP(3),
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING_CONSENT',
    "selectedSubscriptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "azure_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_clerkOrgId_key" ON "tenant"("clerkOrgId");

-- CreateIndex
CREATE INDEX "azure_connection_tenantId_idx" ON "azure_connection"("tenantId");

-- AddForeignKey
ALTER TABLE "azure_connection" ADD CONSTRAINT "azure_connection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
