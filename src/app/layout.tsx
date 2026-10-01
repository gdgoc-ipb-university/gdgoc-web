import type { Metadata } from "next";
import localFont from "next/font/local";
import { ExperienceProvider } from "@/components/experience-provider";
import { openGraph, siteDescription, siteName, siteUrl } from "@/lib/site";
import "lenis/dist/lenis.css";
import "./globals.css";

const pixel = localFont({
  src: "../../node_modules/@fontsource-variable/pixelify-sans/files/pixelify-sans-latin-wght-normal.woff2",
  variable: "--font-pixel",
  display: "swap",
  weight: "400 700",
});
const space = localFont({
  src: "../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
  variable: "--font-space",
  display: "swap",
  weight: "300 700",
});
const mono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "100 800",
  preload: false,
});
const poppins = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2",
      weight: "400",
    },
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2",
      weight: "500",
    },
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2",
      weight: "600",
    },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "GDGoC IPB University — Komunitas Teknologi Mahasiswa Bogor", template: "%s · GDGoC IPB" },
  description: siteDescription,
  applicationName: siteName,
  openGraph,
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${pixel.variable} ${space.variable} ${mono.variable} ${poppins.variable}`}
    >
      <body>
        <ExperienceProvider>{children}</ExperienceProvider>
      </body>
    </html>
  );
}
