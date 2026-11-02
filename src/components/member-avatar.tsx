"use client";

import Image from "next/image";
import { useState } from "react";
import { photoAt } from "@/lib/member-card";

/**
 * A member's small square picture: their photo (uploaded, else Google, #146), or the pixel initial when there is none
 * or it fails to load. Decorative, since the name is always next to it.
 */
export function MemberAvatar({ name, photo, size = 38, className = "" }: { name: string; photo: string | null | undefined; size?: number; className?: string }) {
  const src = photoAt(photo, size * 2);
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <span className={`account-avatar ${className}`} aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>;
  return <Image className={`account-avatar account-avatar-photo ${className}`} src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" unoptimized onError={() => setFailed(src)} />;
}
