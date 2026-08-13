/** @type {import('next').NextConfig} */
const nextConfig = {
  // apps/web imports @cloudguard/shared from the npm workspace as a
  // pre-built package (see packages/shared's own build step), so no extra
  // transpilePackages config is needed here.

  // Next.js 16 auto-generates apps/web/AGENTS.md + CLAUDE.md on every `next
  // dev`/`next build` run. The repo already has an authoritative, checked-in
  // root CLAUDE.md -- disable this to avoid a second, workspace-scoped one.
  agentRules: false,
};

export default nextConfig;
