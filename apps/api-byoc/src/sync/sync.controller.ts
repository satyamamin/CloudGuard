import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import { InstanceStatus, SyncResult } from "@cloudguard/shared";
import { SyncService } from "./sync.service";

@Controller()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get("status")
  async status(): Promise<InstanceStatus> {
    return this.syncService.getStatus();
  }

  @Post("sync")
  @HttpCode(200)
  async sync(): Promise<SyncResult> {
    return this.syncService.triggerSync();
  }
}
