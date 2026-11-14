import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

/**
 * The session is fetched when a page loads, not again every time the tab comes back into view (#269): each fetch is a
 * Convex function call, and a phone switches apps all day. Signing out in another tab still reaches this one, which
 * Better Auth broadcasts, and the Convex token still expires on its own schedule.
 */
export const authClient = createAuthClient({ plugins: [convexClient()], sessionOptions: { refetchOnWindowFocus: false } });
