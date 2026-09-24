"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { authClient } from "@/lib/auth-client";

export function MemberProvider({ children }: { children: ReactNode }) {
  const [convex] = useState(() => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!));
  return <ConvexProviderWithAuth client={convex} useAuth={useMemberAuth}>{children}</ConvexProviderWithAuth>;
}

// Same-origin Next.js auth: obtain the Convex JWT on each requested refresh.
// Convex verifies it before exposing authenticated queries and mutations.
function useMemberAuth() {
  const { data, isPending } = authClient.useSession();
  const sessionId = data?.session.id;
  const fetchAccessToken = useCallback(async () => {
    if (!sessionId) return null;
    try {
      const result = await authClient.convex.token({ fetchOptions: { throw: false } });
      return result.data?.token ?? null;
    } catch { return null; }
  }, [sessionId]);
  return { isLoading: isPending, isAuthenticated: Boolean(sessionId), fetchAccessToken };
}
