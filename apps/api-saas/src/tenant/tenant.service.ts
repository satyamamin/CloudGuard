import { Injectable } from "@nestjs/common";
import { Tenant } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";

// The SaaS tier's multi-tenant analogue of apps/api's InstanceService — but
// where that singleton assumes exactly one Instance row per database, this
// resolves one Tenant row per Clerk organization out of a database shared by
// every SaaS-tier customer.
@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByClerkOrgId(clerkOrgId: string): Promise<Tenant> {
    const existing = await this.prisma.tenant.findUnique({ where: { clerkOrgId } });
    if (existing) {
      return existing;
    }
    return this.prisma.tenant.create({ data: { clerkOrgId } });
  }
}
