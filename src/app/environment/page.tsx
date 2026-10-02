import type { Metadata } from "next";
import Link from "next/link";
import { CampusEnvironment } from "@/components/campus-environment";
import { PixelIcon } from "@/components/pixel-icons";

// A text-free study of the hero scene, reviewed alongside /directions.
export const metadata: Metadata = {
  title: "Hello, Campus! scene",
  robots: { index: false, follow: false },
};

export default function EnvironmentPage() {
  return (
    <main className="environment-study">
      <CampusEnvironment />
      <div className="environment-toolbar">
        <Link href="/"><PixelIcon name="arrow-left" size={24} />Back to landing</Link>
        <span>HELLO, CAMPUS! / AHN IPB</span>
      </div>
    </main>
  );
}
