import { SetMetadata } from "@nestjs/common";

// Marks a route as exempt from ClerkAuthGuard — needed for GET /health,
// which Railway's own infra polls without a Clerk session to present.
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
