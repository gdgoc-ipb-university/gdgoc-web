"use client";

import type { RefObject } from "react";
import { divisions, memberTypeLabels, type MemberType, type OnboardingErrors, type RoleValues } from "@/lib/onboarding";
import { PixelIcon, type PixelIconName } from "./pixel-icons";

const types: { value: MemberType; icon: PixelIconName; description: string }[] = [
  { value: "member", icon: "user", description: "Ikut kegiatan, belajar bareng, dan mengerjakan tugas komunitas." },
  { value: "core", icon: "crown", description: "Pengurus yang menjalankan program dan divisi GDGoC IPB." },
];
const divisionIcons: Record<(typeof divisions)[number], PixelIconName> = {
  "Program & Development": "teach", "Media & Creative": "brush", Technical: "code", "Community & External": "megaphone", "Secretary Treasurer": "notebook",
};

/** Member / Core Team radio cards, with a division choice for the core team. */
export function RoleChoice({ id, value, errors, disabled, onChange, typeRef, divisionRef }: {
  id: string; value: RoleValues; errors: OnboardingErrors; disabled?: boolean; onChange: (value: RoleValues) => void;
  typeRef?: RefObject<HTMLInputElement | null>; divisionRef?: RefObject<HTMLInputElement | null>;
}) {
  return <div className="role-choice">
    <fieldset aria-describedby={errors.memberType ? `${id}-type-error` : undefined}>
      <legend>Peranmu di GDGoC IPB <span aria-hidden="true">*</span></legend>
      <div className="role-options">{types.map((type, index) => <label key={type.value} className="role-option" data-checked={value.memberType === type.value}>
        <input type="radio" name={`${id}-type`} value={type.value} ref={index === 0 ? typeRef : undefined} checked={value.memberType === type.value} disabled={disabled} required
          onChange={() => onChange({ memberType: type.value, division: type.value === "core" ? value.division : "" })} />
        <PixelIcon name={type.icon} size={24} /><span><strong>{memberTypeLabels[type.value]}</strong><small>{type.description}</small></span>
      </label>)}</div>
      {errors.memberType && <p className="role-error" id={`${id}-type-error`}>{errors.memberType}</p>}
    </fieldset>
    {value.memberType === "core" && <fieldset aria-describedby={errors.division ? `${id}-division-error` : undefined}>
      <legend>Divisi <span aria-hidden="true">*</span></legend>
      <div className="role-options role-divisions">{divisions.map((division, index) => <label key={division} className="role-option" data-checked={value.division === division}>
        <input type="radio" name={`${id}-division`} value={division} ref={index === 0 ? divisionRef : undefined} checked={value.division === division} disabled={disabled} required
          onChange={() => onChange({ memberType: "core", division })} />
        <PixelIcon name={divisionIcons[division]} size={22} /><span><strong>{division}</strong></span>
      </label>)}</div>
      {errors.division && <p className="role-error" id={`${id}-division-error`}>{errors.division}</p>}
    </fieldset>}
  </div>;
}
