import { Controller, Get } from "@nestjs/common";
import { HealthResponse } from "@cloudguard/shared";

const API_VERSION = "0.1.0";

@Controller("health")
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: "ok", version: API_VERSION };
  }
}
