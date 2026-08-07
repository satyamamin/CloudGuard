import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { TenantModule } from "./tenant/tenant.module";

@Module({
  imports: [AuthModule, PrismaModule, HealthModule, TenantModule],
})
export class AppModule {}
