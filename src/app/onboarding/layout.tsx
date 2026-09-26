import type { Metadata, Viewport } from "next";
import { MemberProvider } from "@/components/member-provider";
import "./onboarding.css";

export const metadata: Metadata = { title: "Kenalan dengan GDGoC IPB", robots: { index: false, follow: true } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MemberProvider>{children}</MemberProvider>;
}
