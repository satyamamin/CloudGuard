// Thrown by CostsService when Azure Cost Management returns a 429 for the
// subscription being queried. Caught exactly once, globally, by
// AzureQuotaExceededFilter -- nothing else in the app needs to know this
// type exists.
export class AzureQuotaExceededException extends Error {
  constructor(
    public readonly azureSubscriptionId: string,
    public readonly endpoint: string,
    public readonly retryAfterSeconds: number | undefined,
  ) {
    super(`Azure Cost Management quota exceeded for subscription ${azureSubscriptionId} on ${endpoint}`);
    this.name = "AzureQuotaExceededException";
  }
}
