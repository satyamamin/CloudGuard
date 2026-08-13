import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Renamed from middleware.ts for Next.js 16's proxy.ts convention (the
// clerkMiddleware() export name itself is unchanged in @clerk/nextjs v7 --
// verified against node_modules/@clerk/nextjs/dist/types/server/clerkMiddleware.d.ts
// directly, not just docs). The callback and auth.protect() are both async
// as of this version -- auth().protect() (Next.js 14 shape) no longer
// type-checks, it's auth.protect() directly on the callback's first param.
//
// createRouteMatcher() is deprecated upstream in favor of per-route auth
// checks ("as close to the resource as possible") but still functional
// (logs a runtime warning, doesn't error) -- kept as-is rather than
// refactoring auth checks into every protected route file, which is a
// separate, larger change than this Next.js/Clerk version upgrade.
const isProtectedRoute = createRouteMatcher(["/connect-azure(.*)", "/api/instance(.*)", "/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
