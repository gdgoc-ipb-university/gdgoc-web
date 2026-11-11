import type { Metadata } from "next";
import { ProfilePage } from "@/components/dashboard/profile";
import { ProfilePhotoPanel } from "@/components/dashboard/profile-photo";
import { DiscordPanel } from "@/components/dashboard/discord-panel";

export const metadata: Metadata = { title: "Profil" };

export default function Page() { return <ProfilePage photo={<ProfilePhotoPanel />} discord={<DiscordPanel />} />; }
