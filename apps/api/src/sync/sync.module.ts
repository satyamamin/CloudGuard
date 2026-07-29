import { Module } from "@nestjs/common";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";
import { InstanceModule } from "../instance/instance.module";
import { AzureModule } from "../azure/azure.module";

@Module({
  imports: [InstanceModule, AzureModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
