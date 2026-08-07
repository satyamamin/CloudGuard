import { Controller, Get } from "@nestjs/common";
import { HealthResponse } from "@cloudguard/shared";
import { Public } from "../auth/public.decorator";

const API_VERSION = "0.1.0";

@Controller("health")
export class HealthController {
  // Public: Railway's own health-check polling has no Clerk session to
  // present, unlike BYOC's /health whose whole purpose is confirming a
  // paired API key.
  @Public()
  @Get()
  check(): HealthResponse {
    return { status: "ok", version: API_VERSION };
  }
}
