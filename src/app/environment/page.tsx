import Link from "next/link";
import { CampusEnvironment } from "@/components/campus-environment";

export default function EnvironmentPage() {
  return (
    <main className="environment-study">
      <CampusEnvironment />
      <div className="environment-toolbar">
        <Link href="/">← Back to landing</Link>
        <span>HELLO, CAMPUS! / AHN IPB</span>
      </div>
    </main>
  );
}
