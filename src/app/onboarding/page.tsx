import { Suspense } from "react";
import { OnboardingPage } from "@/components/onboarding/flow";

export default function Page() {
  return <Suspense fallback={<main id="main" className="onboard-loading" role="status">Menyiapkan perkenalanmu…</main>}><OnboardingPage /></Suspense>;
}
