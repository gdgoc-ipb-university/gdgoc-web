"use client";

import { useState, type ReactNode } from "react";
import { Button } from "react-aria-components/Button";
import { Checkbox, CheckboxGroup, Label } from "react-aria-components/CheckboxGroup";
import { Radio, RadioGroup } from "react-aria-components/RadioGroup";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { divisions } from "@/lib/onboarding";
import { accessLabels, activeFilterCount, communityLabels, memberAccess, memberCommunity, noFilters, statusLabels, tagLabels, type MemberFilters } from "@/lib/member-table";
import { PixelIcon } from "../pixel-icons";
import { DashboardDialog } from "./data-table";

type Stats = FunctionReturnType<typeof api.dashboard.stats>;
const count = new Intl.NumberFormat("id-ID");

/** The Filter button: its badge counts the facets in use. */
export function FilterButton({ active, onPress }: { active: number; onPress: () => void }) {
  return <button type="button" className="dash-tool-button dash-filter-button" data-active={active > 0} onClick={onPress} aria-label={active ? `Filter, ${active} aktif` : "Filter"}>
    <PixelIcon name="filter" size={18} />Filter{active > 0 && <span className="dash-filter-badge" aria-hidden="true">{active}</span>}
  </button>;
}

/** One removable chip per facet in use, then "Hapus semua". */
export function ActiveFilters({ filters, onChange }: { filters: MemberFilters; onChange: (filters: MemberFilters) => void }) {
  const chips: { key: string; label: string; clear: Partial<MemberFilters> }[] = [];
  if (filters.access.length) chips.push({ key: "access", label: `Akses: ${filters.access.map((value) => accessLabels[value]).join(", ")}`, clear: { access: [] } });
  if (filters.reviewer) chips.push({ key: "reviewer", label: "Peninjau apresiasi", clear: { reviewer: false } });
  if (filters.community.length) chips.push({ key: "community", label: `Komunitas: ${filters.community.map((value) => communityLabels[value]).join(", ")}`, clear: { community: [] } });
  if (filters.divisions.length) chips.push({ key: "divisions", label: `Divisi: ${filters.divisions.join(", ")}`, clear: { divisions: [] } });
  if (filters.status !== "all") chips.push({ key: "status", label: `Status: ${statusLabels[filters.status]}`, clear: { status: "all" } });
  if (filters.tag !== "all") chips.push({ key: "tag", label: `Peran: ${tagLabels[filters.tag].toLowerCase()}`, clear: { tag: "all" } });
  if (!chips.length) return null;
  return <ul className="dash-chips" aria-label="Filter aktif">
    {chips.map((chip) => <li key={chip.key} className="dash-chip"><span>{chip.label}</span>
      <button type="button" aria-label={`Hapus filter ${chip.label}`} onClick={() => onChange({ ...filters, ...chip.clear })}><PixelIcon name="close" size={18} /></button>
    </li>)}
    {chips.length > 1 && <li><button type="button" className="text-button dash-chips-clear" onClick={() => onChange(noFilters)}>Hapus semua</button></li>}
  </ul>;
}

/**
 * The members filter in a dialog: choices stay a draft until "Tampilkan", which shows how many members match first.
 * Counts beside each option are for all members, not narrowed by the other choices.
 */
export function MemberFilterDialog({ open, onClose, value, search, stats, onApply }: {
  open: boolean; onClose: () => void; value: MemberFilters; search: string; stats: Stats | undefined; onApply: (filters: MemberFilters) => void;
}) {
  return <DashboardDialog open={open} onClose={onClose} title="Filter anggota" wide>
    {open && <FilterForm initial={value} search={search} stats={stats} onCancel={onClose} onApply={(filters) => { onApply(filters); onClose(); }} />}
  </DashboardDialog>;
}

function FilterForm({ initial, search, stats, onCancel, onApply }: { initial: MemberFilters; search: string; stats: Stats | undefined; onCancel: () => void; onApply: (filters: MemberFilters) => void }) {
  const [draft, setDraft] = useState(initial);
  const set = (next: Partial<MemberFilters>) => setDraft((current) => ({ ...current, ...next }));
  const preview = useQuery(api.dashboard.members, { search, filters: draft, page: 1, pageSize: 1 });
  const total = preview?.total;
  const counts = stats && {
    access: { owner: stats.owners, admin: stats.admins, member: stats.members - stats.owners - stats.admins },
    community: { member: stats.members - stats.core - stats.bod, core: stats.core, bod: stats.bod },
    status: { all: stats.members, active: stats.members - stats.deactivated, deactivated: stats.deactivated },
    tag: { all: stats.core + stats.bod, confirmed: stats.core + stats.bod - stats.unconfirmed, unconfirmed: stats.unconfirmed },
  };
  return <form className="dash-filter-form" onSubmit={(event) => { event.preventDefault(); onApply(draft); }}>
    <div className="dash-filter-groups">
      <ChipGroup label="Akses dashboard" value={draft.access} onChange={(access) => set({ access: access as MemberFilters["access"] })}
        options={memberAccess.map((value) => ({ value, label: accessLabels[value], count: counts?.access[value] }))} />
      <Checkbox className="dash-filter-toggle" isSelected={draft.reviewer} onChange={(reviewer) => set({ reviewer })}>
        {({ isSelected }) => <><span className="dash-filter-box" aria-hidden="true">{isSelected && <PixelIcon name="check" size={18} />}</span>
          <span><strong>Hanya peninjau apresiasi</strong><small>Diberi izin oleh pemilik, atau Core Team dan BoD Media & Creative yang terkonfirmasi.{stats ? ` ${count.format(stats.reviewers)} orang.` : ""}</small></span></>}
      </Checkbox>
      <ChipGroup label="Peran komunitas" value={draft.community} onChange={(community) => set({ community: community as MemberFilters["community"] })}
        options={memberCommunity.map((value) => ({ value, label: communityLabels[value], count: counts?.community[value] }))} />
      <ChipGroup label="Divisi" hint="Untuk Core Team dan BoD." value={draft.divisions} onChange={(selected) => set({ divisions: selected })}
        options={divisions.map((value) => ({ value, label: value, count: stats?.divisions[value] }))} />
      <Segmented label="Status akun" value={draft.status} onChange={(status) => set({ status })} options={(["all", "active", "deactivated"] as const).map((value) => ({ value, label: statusLabels[value], count: counts?.status[value] }))} />
      <Segmented label="Konfirmasi peran komunitas" hint="Core Team dan BoD yang dipilih sendiri perlu dikonfirmasi staf." value={draft.tag} onChange={(tag) => set({ tag })}
        options={(["all", "confirmed", "unconfirmed"] as const).map((value) => ({ value, label: tagLabels[value], count: counts?.tag[value] }))} />
    </div>
    <div className="dash-dialog-actions dash-filter-actions">
      <button type="button" className="text-button" disabled={!activeFilterCount(draft)} onClick={() => setDraft(noFilters)}>Atur ulang</button>
      <span className="dash-dialog-spacer" />
      <Button className="dash-dialog-button" onPress={onCancel}>Batal</Button>
      <Button type="submit" className="dash-dialog-button" data-primary>{total === undefined ? "Tampilkan" : total ? `Tampilkan ${count.format(total)} anggota` : "Tidak ada yang cocok"}</Button>
    </div>
  </form>;
}

type Option<V extends string> = { value: V; label: string; count?: number };

function GroupLabel({ label, hint }: { label: string; hint?: string }) {
  return <Label className="dash-filter-label">{label}{hint && <small>{hint}</small>}</Label>;
}

function ChipGroup({ label, hint, value, onChange, options }: { label: string; hint?: string; value: string[]; onChange: (value: string[]) => void; options: Option<string>[] }) {
  return <CheckboxGroup className="dash-filter-group" value={value} onChange={onChange}>
    <GroupLabel label={label} hint={hint} />
    <div className="dash-filter-options">{options.map((option) => <Checkbox key={option.value} value={option.value} className="dash-filter-chip">
      {({ isSelected }) => <OptionBody icon={isSelected} label={option.label} count={option.count} />}
    </Checkbox>)}</div>
  </CheckboxGroup>;
}

function Segmented<V extends string>({ label, hint, value, onChange, options }: { label: string; hint?: string; value: V; onChange: (value: V) => void; options: Option<V>[] }) {
  return <RadioGroup className="dash-filter-group" value={value} onChange={(next) => onChange(next as V)} orientation="horizontal">
    <GroupLabel label={label} hint={hint} />
    <div className="dash-segmented">{options.map((option) => <Radio key={option.value} value={option.value} className="dash-segment">
      <OptionBody label={option.label} count={option.count} />
    </Radio>)}</div>
  </RadioGroup>;
}

function OptionBody({ icon, label, count: total }: { icon?: boolean; label: ReactNode; count?: number }) {
  return <>{icon && <PixelIcon name="check" size={18} />}<span>{label}</span>{total !== undefined && <span className="dash-filter-count">{count.format(total)}</span>}</>;
}
