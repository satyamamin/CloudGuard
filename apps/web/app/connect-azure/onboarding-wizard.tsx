"use client";

import { useState } from "react";
import { PairingForm } from "@/components/connect-azure/pairing-form";
import { OnboardingStepper } from "@/components/connect-azure/onboarding-stepper";

// Bridges the pairing step (PairingForm) into the discover/select/sync
// sequence (OnboardingStepper) without a full page reload, and lets an
// already-paired org (server-rendered `initiallyPaired`) skip straight to it.
export function OnboardingWizard({ initiallyPaired }: { initiallyPaired: boolean }) {
  const [paired, setPaired] = useState(initiallyPaired);

  if (!paired) {
    return <PairingForm onPaired={() => setPaired(true)} />;
  }

  return <OnboardingStepper />;
}
