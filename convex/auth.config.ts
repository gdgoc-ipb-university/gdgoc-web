import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

/**
 * With JWKS set on the deployment (see getLatestJwks in auth.ts), Convex checks each token against that public key
 * instead of fetching /api/auth/convex/jwks for every new token (#269); `convex env set JWKS` applies without a deploy.
 * Unset, Convex fetches the keys as before. Convex refuses a push whose auth config reads an unset variable, and it does
 * so by throwing on the read, so the read is caught: the first deploy works before JWKS exists.
 */
function staticJwks() {
  try { return process.env.JWKS || undefined; } catch { return undefined; }
}

export default { providers: [getAuthConfigProvider({ jwks: staticJwks() })] } satisfies AuthConfig;
