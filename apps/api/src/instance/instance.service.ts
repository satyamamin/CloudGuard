import { Injectable } from "@nestjs/common";
import { Instance } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// There is exactly one Instance row per deployment (see docs/connect-azure.md
// — "single configuration row", no multi-tenancy scoping). This helper is the
// one place that assumption lives, so callers never have to know or care
// about instance IDs.
@Injectable()
export class InstanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(): Promise<Instance> {
    const existing = await this.prisma.instance.findFirst();
    if (existing) {
      return existing;
    }
    return this.prisma.instance.create({ data: {} });
  }

  async update(id: string, data: Partial<Instance>): Promise<Instance> {
    return this.prisma.instance.update({ where: { id }, data });
  }
}
