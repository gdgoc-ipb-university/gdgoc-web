import Link from "next/link";
import { CampusEnvironment } from "@/components/campus-environment";
import { SceneControls } from "@/components/scene-controls";

export default function EnvironmentPage() {
  return (
    <main className="environment-study">
      <CampusEnvironment />
      <div className="environment-toolbar">
        <Link href="/">← Back to landing</Link>
        <span>HELLO, CAMPUS! / AHN IPB</span>
        <SceneControls />
      </div>
    </main>
  );
}
