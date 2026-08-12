import { DailyCost, ResourceCost, ServiceCost } from "@cloudguard/shared";

// Dev-only fixtures for USE_MOCK_COST_DATA=true — lets UI work proceed without
// burning Azure Cost Management's per-subscription throttle quota (see
// CLAUDE.md's Cost Management gotchas). Deterministic per subscriptionId/day
// so charts stay stable across reloads instead of jumping around randomly.

const MOCK_SERVICES = [
  "Virtual Machines",
  "Storage",
  "Azure Database for PostgreSQL",
  "Container Apps",
  "Bandwidth",
  "Azure Monitor",
  "Key Vault",
];

const MOCK_RESOURCE_GROUP = "rg-cloudguard-dev";
const MOCK_RESOURCES = [
  { name: "vm-web-01", provider: "Microsoft.Compute/virtualMachines" },
  { name: "stcloudguarddata", provider: "Microsoft.Storage/storageAccounts" },
  { name: "psql-cloudguard", provider: "Microsoft.DBforPostgreSQL/flexibleServers" },
  { name: "ca-api-prod", provider: "Microsoft.App/containerApps" },
  { name: "kv-cloudguard-secrets", provider: "Microsoft.KeyVault/vaults" },
];

// Small deterministic hash -> [0, 1), so the same (subscriptionId, seed) pair
// always produces the same "random" value. A plain polynomial rolling hash
// gives near-identical output for inputs that only differ in their last
// character (e.g. consecutive dates "...08-06" vs "...08-07") because the
// last character carries the least weight — so every "day" came out as the
// same cost. The Murmur3 finalizer mix below spreads the bits properly.
function seededRandom(...parts: string[]): number {
  let hash = 0;
  const input = parts.join("|");
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0xffffffff;
}

export function mockDailyCosts(azureSubscriptionId: string, from: string, to: string): { currency: string; from: string; to: string; days: DailyCost[] } {
  const days: DailyCost[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const base = 40 + seededRandom(azureSubscriptionId, dateStr) * 60;
    days.push({ date: dateStr, cost: Math.round(base * 100) / 100 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { currency: "EUR", from, to, days };
}

export function mockCostByService(azureSubscriptionId: string, from: string, to: string): { currency: string; from: string; to: string; services: ServiceCost[] } {
  const services: ServiceCost[] = MOCK_SERVICES.map((serviceName) => ({
    serviceName,
    cost: Math.round(seededRandom(azureSubscriptionId, from, to, serviceName) * 500 * 100) / 100,
  })).sort((a, b) => b.cost - a.cost);

  return { currency: "EUR", from, to, services };
}

export function mockCostByResource(azureSubscriptionId: string, from: string, to: string): { currency: string; from: string; to: string; resources: ResourceCost[] } {
  const resources: ResourceCost[] = MOCK_RESOURCES.map(({ name, provider }) => ({
    resourceId: `/subscriptions/${azureSubscriptionId}/resourceGroups/${MOCK_RESOURCE_GROUP}/providers/${provider}/${name}`,
    resourceName: name,
    cost: Math.round(seededRandom(azureSubscriptionId, from, to, name) * 300 * 100) / 100,
  })).sort((a, b) => b.cost - a.cost);

  return { currency: "EUR", from, to, resources };
}
