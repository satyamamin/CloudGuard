#!/usr/bin/env node
// Minimal regression check for a running apps/api-byoc instance -- run this
// against a candidate build (local, the real Azure test deployment, or a
// freshly-tagged image someone spun up) before cutting a release tag, so
// "upgraded and shipped" means more than "it compiled."
//
// Usage:
//   BACKEND_URL=http://localhost:3001 API_KEY=... node scripts/smoke-test.mjs
//   node scripts/smoke-test.mjs http://localhost:3001 <api-key>
//
// Deliberately does NOT call POST /subscriptions/select or POST /sync --
// both mutate the singleton Instance row, and /sync additionally burns
// against Azure Cost Management's per-subscription throttle (see CLAUDE.md).
// Run those by hand if you specifically need to test the sync path.

async function call(backendUrl, apiKey, path) {
  try {
    const res = await fetch(`${backendUrl}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: "unreachable", body: err.message };
  }
}

async function main() {
  const backendUrl = (process.env.BACKEND_URL ?? process.argv[2] ?? "").replace(/\/$/, "");
  const apiKey = process.env.API_KEY ?? process.argv[3];

  if (!backendUrl || !apiKey) {
    console.error("Usage: BACKEND_URL=<url> API_KEY=<key> node scripts/smoke-test.mjs");
    console.error("   or: node scripts/smoke-test.mjs <url> <key>");
    process.exitCode = 1;
    return;
  }

  // Hard checks: these must always work on any correctly-running instance,
  // regardless of onboarding state (no subscriptions selected yet is fine).
  const hardChecks = [
    { name: "GET /health", path: "/health" },
    { name: "GET /subscriptions", path: "/subscriptions" },
    { name: "GET /status", path: "/status" },
  ];

  // Soft check: only meaningful once a customer has actually selected
  // subscriptions, and can legitimately 429 (Azure Cost Management throttles
  // per subscription, not per caller -- a real prior sync elsewhere against
  // the same subscription is enough to trip this). Reported, not fatal.
  const softChecks = [{ name: "GET /costs/daily?days=7", path: "/costs/daily?days=7" }];

  let hardFailures = 0;

  console.log(`Smoke-testing ${backendUrl}\n`);

  for (const { name, path } of hardChecks) {
    const result = await call(backendUrl, apiKey, path);
    if (result.ok) {
      console.log(`  PASS  ${name}${path === "/health" ? ` (version ${result.body?.version})` : ""}`);
    } else {
      hardFailures++;
      console.log(`  FAIL  ${name} -> ${result.status} ${JSON.stringify(result.body)}`);
    }
  }

  for (const { name, path } of softChecks) {
    const result = await call(backendUrl, apiKey, path);
    if (result.ok) {
      console.log(`  PASS  ${name}`);
    } else if (result.status === 401 || result.status === 403) {
      // Auth failures are real regressions even on a soft check.
      hardFailures++;
      console.log(`  FAIL  ${name} -> ${result.status} (auth failure, not a soft condition)`);
    } else {
      console.log(`  WARN  ${name} -> ${result.status} (expected if no subscriptions selected yet, or Azure is throttling -- not a hard failure)`);
    }
  }

  console.log();
  if (hardFailures > 0) {
    console.error(`${hardFailures} hard check(s) failed.`);
    process.exitCode = 1;
    return;
  }
  console.log("All hard checks passed.");
}

main();
