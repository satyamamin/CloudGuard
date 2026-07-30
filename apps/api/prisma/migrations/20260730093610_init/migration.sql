-- CreateTable
CREATE TABLE "instance" (
    "id" TEXT NOT NULL,
    "selectedSubscriptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instance_pkey" PRIMARY KEY ("id")
);
