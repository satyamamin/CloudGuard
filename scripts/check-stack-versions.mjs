#!/usr/bin/env node
// Reports current vs. latest-published versions for every workspace's npm
// dependencies, plus the handful of non-npm stack pieces this monorepo
// pins (Node.js runtime, Docker base images, Postgres major, Bicep CLI).
// Run periodically to see what's safe to bump -- see docs/architecture.md's
// "Keeping the stack current" section for how to read the output.
//
// Usage: node scripts/check-stack-versions.mjs   (or: npm run check-versions)

import { execSync } from "node:child_process";

function npmOutdated() {
  let raw;
  try {
    // npm outdated exits 1 when anything is outdated -- that's its normal
    // signal, not a failure, so stdout is still captured either way.
    raw = execSync("npm outdated --workspaces --json", { encoding: "utf8" });
  } catch (err) {
    raw = err.stdout?.toString() ?? "{}";
  }
  return raw.trim() ? JSON.parse(raw) : {};
}

function printNpmTable(outdated) {
  // npm reports one entry per dependent workspace -- a plain object for a
  // package declared in just one workspace, but an *array* of entries when
  // the same package is declared by two or more (e.g. `typescript` in both
  // apps/api-byoc and packages/shared). Flatten both shapes into one row
  // per (package, dependent) pair instead of assuming the single-object shape.
  const rows = Object.entries(outdated).flatMap(([name, info]) =>
    (Array.isArray(info) ? info : [info]).map((entry) => ({
      package: name,
      current: entry.current ?? "(not installed)",
      wanted: entry.wanted,
      latest: entry.latest,
      dependent: entry.dependent ?? "",
    }))
  );
  if (rows.length === 0) {
    console.log("All npm-managed dependencies are already at their latest published version.\n");
    return;
  }
  console.log(`${rows.length} npm package(s) have a newer version published:\n`);
  console.table(rows);
  console.log(
    "'wanted'  = highest version matching the current package.json range (a plain `npm install` picks this up)\n" +
      "'latest'  = newest published version regardless of range (may be a major bump -- read the changelog first)\n"
  );
}

async function checkNodeLts() {
  try {
    const res = await fetch("https://nodejs.org/dist/index.json");
    const releases = await res.json();
    return releases.find((r) => r.lts)?.version ?? null;
  } catch {
    return null;
  }
}

async function checkBicepCli() {
  try {
    const res = await fetch("https://api.github.com/repos/Azure/bicep/releases/latest");
    const data = await res.json();
    return data.tag_name ?? null;
  } catch {
    return null;
  }
}

async function latestAlpineMajor(image) {
  // Highest published "<major>-alpine" tag for a Docker Hub library image --
  // a coarse "is a newer -alpine line out" check, not a full tag history.
  try {
    const res = await fetch(`https://hub.docker.com/v2/repositories/library/${image}/tags?page_size=100&name=alpine`);
    const data = await res.json();
    const majors = (data.results ?? [])
      .map((t) => t.name.match(/^(\d+)-alpine$/)?.[1])
      .filter(Boolean)
      .map(Number);
    return majors.length ? Math.max(...majors) : null;
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== npm-managed dependencies (root, apps/*, packages/*) ===\n");
  printNpmTable(npmOutdated());

  console.log("=== Runtime / infra pins (checked against public sources) ===\n");
  const [nodeLts, bicepLatest, nodeImageMajor, postgresImageMajor] = await Promise.all([
    checkNodeLts(),
    checkBicepCli(),
    latestAlpineMajor("node"),
    latestAlpineMajor("postgres"),
  ]);

  console.table([
    { component: "Node.js (this machine)", pinned: process.version, latestLTS: nodeLts ?? "(couldn't fetch)" },
    { component: "Docker node:20-alpine (apps/api-byoc/Dockerfile)", pinnedMajor: 20, latestAlpineMajor: nodeImageMajor ?? "(couldn't fetch)" },
    { component: "Docker postgres:16-alpine (docker-compose.dev.yml) + Flexible Server version (infra/bicep)", pinnedMajor: 16, latestAlpineMajor: postgresImageMajor ?? "(couldn't fetch)" },
    { component: "az bicep CLI (run `az bicep version` locally to see yours)", pinned: "-", latestRelease: bicepLatest ?? "(couldn't fetch)" },
  ]);
}

main();
