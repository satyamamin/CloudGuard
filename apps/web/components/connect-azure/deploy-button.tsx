import { Button } from "@/components/ui/button";

// Portal deep-link format documented in infra/bicep/README.md — the Portal
// only accepts a URL-encoded raw main.json URL, not a raw .bicep file.
function buildPortalDeployUrl(templateUri: string): string {
  return `https://portal.azure.com/#create/Microsoft.Template/uri/${encodeURIComponent(templateUri)}`;
}

export function DeployButton() {
  const templateUri = process.env.NEXT_PUBLIC_BICEP_TEMPLATE_URI;

  if (!templateUri) {
    return (
      <p className="text-sm text-red-600">
        NEXT_PUBLIC_BICEP_TEMPLATE_URI is not configured — see apps/web/.env.local.example.
      </p>
    );
  }

  return (
    <a href={buildPortalDeployUrl(templateUri)} target="_blank" rel="noopener noreferrer">
      <Button>Deploy to Azure</Button>
    </a>
  );
}
