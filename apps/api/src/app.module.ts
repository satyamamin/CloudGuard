import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { SyncModule } from "./sync/sync.module";

@Module({
  imports: [AuthModule, PrismaModule, HealthModule, SubscriptionsModule, SyncModule],
})
export class AppModule {}
