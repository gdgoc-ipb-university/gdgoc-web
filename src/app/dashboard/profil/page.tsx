import type { Metadata } from "next";
import { ProfilePage } from "@/components/dashboard/profile";

export const metadata: Metadata = { title: "Profil" };

export default function Page() { return <ProfilePage />; }
