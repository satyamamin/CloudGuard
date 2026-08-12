"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AzureSubscription } from "@finops-lab/shared";
import { Button } from "@/components/ui/button";

type Step = "discovering" | "select" | "syncing" | "done" | "error";

export function OnboardingStepper() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("discovering");
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/instance/subscriptions")
      .then((res) => {
        if (!res.ok) throw new Error("Could not discover subscriptions");
        return res.json();
      })
      .then((subs: AzureSubscription[]) => {
        setSubscriptions(subs);
        setStep("select");
      })
      .catch((err) => {
        setError(err.message);
        setStep("error");
      });
  }, []);

  function toggle(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  async function handleSelectAndSync() {
    setStep("syncing");
    setError(null);

    try {
      const selectResponse = await fetch("/api/instance/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionIds: selectedIds }),
      });
      if (!selectResponse.ok) throw new Error("Could not save your subscription selection");

      const syncResponse = await fetch("/api/instance/sync", { method: "POST" });
      if (!syncResponse.ok) throw new Error("Sync failed to start");

      setStep("done");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  if (step === "discovering") {
    return <p className="text-sm text-slate-500">Discovering subscriptions visible to your deployment...</p>;
  }

  if (step === "error") {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (step === "syncing") {
    return <p className="text-sm text-slate-500">Crunching your data...</p>;
  }

  if (step === "done") {
    return <p className="text-sm text-green-700">Sync started. Your dashboard will populate shortly.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Choose which subscriptions to monitor:</p>
      <ul className="space-y-2">
        {subscriptions.map((sub) => (
          <li key={sub.azureSubscriptionId} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.includes(sub.azureSubscriptionId)}
              onChange={() => toggle(sub.azureSubscriptionId)}
            />
            <span className="text-sm">{sub.displayName}</span>
          </li>
        ))}
      </ul>
      <Button onClick={handleSelectAndSync} disabled={selectedIds.length === 0}>
        Start syncing
      </Button>
    </div>
  );
}
