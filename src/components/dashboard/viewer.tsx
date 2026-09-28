"use client";

import { createContext, useContext } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type DashboardViewer = NonNullable<FunctionReturnType<typeof api.dashboard.viewer>>;
export const ViewerContext = createContext<DashboardViewer | null>(null);

export function useDashboardViewer() {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useDashboardViewer must be used inside DashboardShell.");
  return viewer;
}

export function isStaff(viewer: DashboardViewer) { return viewer.role !== "member"; }
/** Apresiasi reviewers are the configured owners (APPRECIATION_ADMIN_EMAILS). */
export function isReviewer(viewer: DashboardViewer) { return viewer.role === "owner"; }
