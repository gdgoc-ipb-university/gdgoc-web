import type { Metadata } from "next";
import { Landing } from "@/components/landing";
import { communityLinks } from "@/lib/community";
import { directions } from "@/lib/directions";
import { canonical, siteDescription, siteName, siteUrl } from "@/lib/site";

// `?motion=` and `?webgl=` are previews of this same page.
export const metadata: Metadata = canonical("/");

const organization = { "@id": `${siteUrl}/#organization` };
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      ...organization,
      "@type": "Organization",
      name: "GDGoC IPB University",
      // "GDG on Campus IPB University" is the name on the official chapter page, which also records the earlier GDSC IPB.
      alternateName: [siteName, "GDG on Campus IPB University", "Google Developer Group on Campus IPB University", "GDSC IPB"],
      description: siteDescription,
      url: `${siteUrl}/`,
      logo: `${siteUrl}/brand/gdgoc-ipb.svg`,
      sameAs: [communityLinks.membership, communityLinks.instagram],
      address: { "@type": "PostalAddress", addressLocality: "Bogor", addressRegion: "Jawa Barat", addressCountry: "ID" },
    },
    {
      "@id": `${siteUrl}/#website`,
      "@type": "WebSite",
      name: siteName,
      alternateName: ["GDGoC IPB University", "GDG on Campus IPB University"],
      url: `${siteUrl}/`,
      inLanguage: "id",
      publisher: organization,
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Landing direction={directions[0]} />
    </>
  );
}
