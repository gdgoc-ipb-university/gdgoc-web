import type { Metadata } from "next";
import { CardCheck } from "@/components/card-check";
import { Header } from "@/components/header";
import { MemberProvider } from "@/components/member-provider";

// The token in the URL is the card: keep the page out of search, and the token out of the Referer of outgoing links.
export const metadata: Metadata = {
  title: "Periksa kartu anggota",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MemberProvider><Header /><main id="main" className="card-check-page section-width"><CardCheck token={token} /></main></MemberProvider>;
}
