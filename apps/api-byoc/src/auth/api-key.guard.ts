import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";

// Single shared-secret auth: the frontend pairs with exactly one deployed
// instance using the API key produced as a deployment output (see
// infra/bicep). Applied globally, including to GET /health — per
// docs/byoc/connect-azure.md the health check's whole purpose is to confirm the
// pairing (URL + key) is valid, so the key must already be presented there.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const expected = process.env.API_KEY;

    if (!expected) {
      throw new UnauthorizedException("API_KEY is not configured on this instance");
    }

    const presented = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (!presented || presented !== expected) {
      throw new UnauthorizedException("Invalid or missing API key");
    }

    return true;
  }
}
