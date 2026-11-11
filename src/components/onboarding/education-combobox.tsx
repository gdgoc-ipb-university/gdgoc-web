"use client";

import { useMemo, type Ref } from "react";
import { Button, ComboBox, FieldError, Input, Label, ListBox, ListBoxItem, Popover, Text } from "react-aria-components/ComboBox";
import { searchEducation, type EducationOption } from "@/lib/education-options";
import { PixelIcon } from "../pixel-icons";

type Props = {
  id: string; label: string; value: string; onChange: (value: string) => void;
  options: EducationOption[]; error?: string; disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>; enterKeyHint: "next" | "done";
  /** Shown under the field; defaults to the note that unlisted names are fine. */
  hint?: string;
  /** `field` draws it as a dashboard field, with the list of the shared Select, for the profile forms (#235). */
  appearance?: "onboarding" | "field";
};

const looks = {
  onboarding: { root: "onboard-combobox", required: undefined, control: "onboard-combo-control", trigger: "onboard-combo-trigger", hint: "onboard-hint", error: "onboard-field-error", popover: "onboard-combo-popover", list: "onboard-combo-list", option: "onboard-combo-option", text: "onboard-combo-text", empty: "onboard-combo-empty", icon: 24 },
  field: { root: "app-field dash-combobox", required: "field-required", control: "dash-combo-control", trigger: "dash-combo-trigger", hint: "field-hint", error: "field-error", popover: "select-popover dash-combo-popover", list: "select-list", option: "select-option", text: "dash-combo-text", empty: "dash-combo-empty", icon: 18 },
};

/** How many matches the list shows at once; typing narrows a list of thousands down to these. */
const shown = 50;

export function EducationCombobox({ id, label, value, onChange, options, error, disabled, inputRef, enterKeyHint, hint, appearance = "onboarding" }: Props) {
  const look = looks[appearance];
  // The list is filtered here rather than by React Aria, so only the best `shown` matches are ever rendered.
  const items = useMemo(() => searchEducation(options, value, shown), [options, value]);
  const selected = useMemo(() => options.some((option) => option.name === value) ? value : null, [options, value]);
  return <ComboBox<EducationOption>
    className={look.root} name={id} items={items}
    inputValue={value} onInputChange={onChange}
    value={selected}
    onChange={(key) => { if (key !== null) onChange(String(key)); }}
    allowsCustomValue allowsEmptyCollection isRequired isDisabled={disabled}
    isInvalid={Boolean(error)} validationBehavior="aria" menuTrigger="focus"
  >
    <Label>{label}<span className={look.required} aria-hidden="true"> *</span></Label>
    <div className={look.control}>
      <Input id={id} ref={inputRef} placeholder={`Cari atau ketik ${label.toLowerCase()}`} maxLength={150} inputMode="text" enterKeyHint={enterKeyHint} autoComplete="off" autoCapitalize="words" spellCheck={false} />
      <Button className={look.trigger} aria-label={`Tampilkan pilihan ${label.toLowerCase()}`}><PixelIcon name="chevron-down" size={look.icon} /></Button>
    </div>
    <Text slot="description" className={look.hint}>{hint ?? "Belum ada di daftar? Ketik nama lengkapnya."}</Text>
    <FieldError className={look.error}>{error}</FieldError>
    <Popover className={look.popover} offset={6} data-lenis-prevent>
      <ListBox<EducationOption> className={look.list} renderEmptyState={() => <p className={look.empty}>Tidak ada saran yang cocok. Nama yang kamu ketik tetap bisa dipakai.</p>}>
        {(option) => <ListBoxItem id={option.name} textValue={option.name} className={look.option}>{({ isSelected }) => <>
          <span className={look.text}><Text slot="label">{option.name}</Text>{option.detail && <Text slot="description" elementType="small">{option.detail}</Text>}</span>
          <span aria-hidden="true">{isSelected ? <PixelIcon name="check" size={look.icon} /> : null}</span>
        </>}</ListBoxItem>}
      </ListBox>
    </Popover>
  </ComboBox>;
}
