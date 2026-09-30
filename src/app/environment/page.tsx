import Link from "next/link";
import { CampusEnvironment } from "@/components/campus-environment";
import { PixelIcon } from "@/components/pixel-icons";

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
