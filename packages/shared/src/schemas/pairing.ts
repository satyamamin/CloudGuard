import { z } from "zod";

// The pairing a FinOps Lab org stores (in Clerk private org metadata) once
// it links to a customer-deployed backend instance from a "Deploy to Azure" run.
export const instancePairingSchema = z.object({
  backendUrl: z.string().url(),
  apiKey: z.string().min(1),
});
export type InstancePairing = z.infer<typeof instancePairingSchema>;

// What the frontend is allowed to render back to the browser: the API key
// is never sent to the client in full, only a redacted trailing fragment.
export const maskedInstancePairingSchema = z.object({
  backendUrl: z.string().url(),
  apiKeyLast4: z.string().length(4),
});
export type MaskedInstancePairing = z.infer<typeof maskedInstancePairingSchema>;

export function maskApiKey(apiKey: string): string {
  return apiKey.slice(-4);
}
