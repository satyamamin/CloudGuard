/** @type {import('next').NextConfig} */
const nextConfig = {
  // apps/web imports @cloudguard/shared from the npm workspace as a
  // pre-built package (see packages/shared's own build step), so no extra
  // transpilePackages config is needed here.
};

export default nextConfig;
