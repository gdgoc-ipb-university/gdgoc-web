"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function MemberGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.members.profile, isAuthenticated ? {} : "skip");
  const router = useRouter();
  const pathname = usePathname();
  const destination = pathname === "/apresiasi/admin" ? "/onboarding?next=review" : "/onboarding";
  const needsOnboarding = isAuthenticated && profile !== undefined && !profile?.completedAt;
  useEffect(() => { if (needsOnboarding) router.replace(destination); }, [needsOnboarding, destination, router]);
  if (isLoading || (isAuthenticated && (profile === undefined || needsOnboarding))) {
    return <main id="main" className="appreciation-page section-width"><p className="app-panel" role="status">{needsOnboarding ? "Menyiapkan perkenalan singkatmu…" : "Menghubungkan akunmu…"}</p>{needsOnboarding && <Link className="text-button" href={destination}>Lanjut ke perkenalan →</Link>}</main>;
  }
  return children;
}
