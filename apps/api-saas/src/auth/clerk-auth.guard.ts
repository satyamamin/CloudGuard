import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { verifyToken } from "@clerk/backend";
import { IS_PUBLIC_KEY } from "./public.decorator";

export interface AuthenticatedRequest extends Request {
  clerkOrgId: string;
}

// Verifies the Clerk session JWT apps/web's server-side route handlers
// forward on behalf of a logged-in org — this backend is never called
// directly from a browser, so reusing that JWT avoids standing up a second
// credential system. A second, internal-only header (SAAS_INTERNAL_SECRET)
// is checked as defense-in-depth: it narrows the caller to "apps/web's
// server", the same way BYOC's ApiKeyGuard narrows the caller to "the one
// paired frontend" — but unlike ApiKeyGuard's single shared secret (which
// maps 1:1 to one customer deployment), a single shared secret here can't
// scope by tenant on its own. Tenant identity always comes from the verified
// JWT's org_id claim, never from the secret alone.
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const internalSecret = process.env.SAAS_INTERNAL_SECRET;
    if (internalSecret && request.headers["x-internal-secret"] !== internalSecret) {
      throw new UnauthorizedException("Missing or invalid internal secret");
    }

    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new UnauthorizedException("CLERK_SECRET_KEY is not configured");
    }

    let orgId: string | undefined;
    try {
      const payload = await verifyToken(token, { secretKey });
      orgId = payload.org_id;
    } catch {
      throw new UnauthorizedException("Invalid session token");
    }

    if (!orgId) {
      throw new UnauthorizedException("Session token has no active organization");
    }

    request.clerkOrgId = orgId;
    return true;
  }
}
