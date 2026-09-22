import type { Metadata } from "next";
import localFont from "next/font/local";
import { ExperienceProvider } from "@/components/experience-provider";
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
  title: { default: "GDGoC IPB — Komunitas Teknologi Mahasiswa IPB", template: "%s · GDGoC IPB" },
  description:
    "Komunitas teknologi mahasiswa IPB University. Belajar coding, UI/UX, dan AI lewat sesi praktik, proyek tim, serta persiapan kompetisi bersama GDGoC IPB.",
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
