"use client";

import type { Ref } from "react";
import { Button, ComboBox, FieldError, Input, Label, ListBox, ListBoxItem, Popover, Text } from "react-aria-components/ComboBox";
import type { EducationOption } from "@/lib/education-options";

type Props = {
  id: string; label: string; value: string; onChange: (value: string) => void;
  options: EducationOption[]; error?: string; disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>; enterKeyHint: "next" | "done";
};

export function EducationCombobox({ id, label, value, onChange, options, error, disabled, inputRef, enterKeyHint }: Props) {
  return <ComboBox<EducationOption>
    className="onboard-combobox" name={id} defaultItems={options}
    inputValue={value} onInputChange={onChange}
    value={options.some((option) => option.name === value) ? value : null}
    onChange={(key) => { if (key !== null) onChange(String(key)); }}
    defaultFilter={(text, search) => `${text} ${options.find((option) => option.name === text)?.keywords ?? ""}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID"))}
    allowsCustomValue allowsEmptyCollection isRequired isDisabled={disabled}
    isInvalid={Boolean(error)} validationBehavior="aria" menuTrigger="focus"
  >
    <Label>{label}<span aria-hidden="true"> *</span></Label>
    <div className="onboard-combo-control">
      <Input id={id} ref={inputRef} placeholder={`Cari atau ketik ${label.toLowerCase()}`} maxLength={150} inputMode="text" enterKeyHint={enterKeyHint} autoComplete="off" autoCapitalize="words" spellCheck={false} />
      <Button className="onboard-combo-trigger" aria-label={`Tampilkan pilihan ${label.toLowerCase()}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></Button>
    </div>
    <Text slot="description" className="onboard-hint">Belum ada di daftar? Ketik nama lengkapnya.</Text>
    <FieldError className="onboard-field-error">{error}</FieldError>
    <Popover className="onboard-combo-popover" offset={6} data-lenis-prevent>
      <ListBox<EducationOption> className="onboard-combo-list" renderEmptyState={() => <p className="onboard-combo-empty">Tidak ada saran yang cocok. Nama yang kamu ketik tetap bisa dipakai.</p>}>
        {(option) => <ListBoxItem id={option.name} textValue={option.name} className="onboard-combo-option">{({ isSelected }) => <><span>{option.name}</span><span aria-hidden="true">{isSelected ? "✓" : ""}</span></>}</ListBoxItem>}
      </ListBox>
    </Popover>
  </ComboBox>;
}
