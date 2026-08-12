import { Injectable } from "@nestjs/common";
import { AzureCliCredential, DefaultAzureCredential, TokenCredential } from "@azure/identity";

// AZURE_AUTH_MODE picks the credential explicitly instead of leaning on
// DefaultAzureCredential's implicit fallback chain everywhere:
//  - "managed-identity": set inside the Container App deployed into the
//    customer's tenant. DefaultAzureCredential resolves the system-assigned
//    Managed Identity with no further config.
//  - "cli": used for local dev. Requires `az login`; calls run under the
//    developer's own RBAC-assigned permissions, not a Managed Identity.
@Injectable()
export class AzureCredentialProvider {
  private readonly credential: TokenCredential;

  constructor() {
    const mode = process.env.AZURE_AUTH_MODE ?? "managed-identity";
    this.credential = mode === "cli" ? new AzureCliCredential() : new DefaultAzureCredential();
  }

  get(): TokenCredential {
    return this.credential;
  }
}
