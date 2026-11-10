"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { memberIntake, memberIntakeState } from "@/lib/member-intake";

// The dialog, with react-aria, is downloaded only for a visitor who is going to see it.
const MemberIntakeDialog = lazy(() => import("./member-intake-dialog").then(({ MemberIntakeDialog }) => ({ default: MemberIntakeDialog })));

// Once per page load even where storage is blocked: coming back to the landing without a reload does not reopen it.
let shownThisLoad = false;

function closedBefore() {
  try { return localStorage.getItem(memberIntake.seenKey) !== null; } catch { return false; }
}

function rememberClosed() {
  try { localStorage.setItem(memberIntake.seenKey, "1"); } catch { /* storage blocked: it shows again on the next page load */ }
}

/**
 * The member intake popup (#211) over the landing while registration is open, at most once per browser: however it is
 * closed, localStorage remembers it. It is decided in the browser after hydration, from the visitor's clock and storage,
 * so the prerendered landing never contains it. It waits for `ready`, for example while the scene's loading screen is up.
 */
export function MemberIntakePopup({ ready = true }: { ready?: boolean }) {
  const [due, setDue] = useState(false);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (shownThisLoad || memberIntakeState(Date.now()) !== "open" || closedBefore()) return;
      shownThisLoad = true;
      setDue(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!due) return null;
  return <Suspense fallback={null}>
    <MemberIntakeDialog isOpen={ready && !closed} onClose={() => { rememberClosed(); setClosed(true); }} />
  </Suspense>;
}
