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
};

/** How many matches the list shows at once; typing narrows a list of thousands down to these. */
const shown = 50;

export function EducationCombobox({ id, label, value, onChange, options, error, disabled, inputRef, enterKeyHint, hint }: Props) {
  // The list is filtered here rather than by React Aria, so only the best `shown` matches are ever rendered.
  const items = useMemo(() => searchEducation(options, value, shown), [options, value]);
  const selected = useMemo(() => options.some((option) => option.name === value) ? value : null, [options, value]);
  return <ComboBox<EducationOption>
    className="onboard-combobox" name={id} items={items}
    inputValue={value} onInputChange={onChange}
    value={selected}
    onChange={(key) => { if (key !== null) onChange(String(key)); }}
    allowsCustomValue allowsEmptyCollection isRequired isDisabled={disabled}
    isInvalid={Boolean(error)} validationBehavior="aria" menuTrigger="focus"
  >
    <Label>{label}<span aria-hidden="true"> *</span></Label>
    <div className="onboard-combo-control">
      <Input id={id} ref={inputRef} placeholder={`Cari atau ketik ${label.toLowerCase()}`} maxLength={150} inputMode="text" enterKeyHint={enterKeyHint} autoComplete="off" autoCapitalize="words" spellCheck={false} />
      <Button className="onboard-combo-trigger" aria-label={`Tampilkan pilihan ${label.toLowerCase()}`}><PixelIcon name="chevron-down" size={24} /></Button>
    </div>
    <Text slot="description" className="onboard-hint">{hint ?? "Belum ada di daftar? Ketik nama lengkapnya."}</Text>
    <FieldError className="onboard-field-error">{error}</FieldError>
    <Popover className="onboard-combo-popover" offset={6} data-lenis-prevent>
      <ListBox<EducationOption> className="onboard-combo-list" renderEmptyState={() => <p className="onboard-combo-empty">Tidak ada saran yang cocok. Nama yang kamu ketik tetap bisa dipakai.</p>}>
        {(option) => <ListBoxItem id={option.name} textValue={option.name} className="onboard-combo-option">{({ isSelected }) => <>
          <span className="onboard-combo-text"><Text slot="label">{option.name}</Text>{option.detail && <Text slot="description" elementType="small">{option.detail}</Text>}</span>
          <span aria-hidden="true">{isSelected ? <PixelIcon name="check" size={24} /> : null}</span>
        </>}</ListBoxItem>}
      </ListBox>
    </Popover>
  </ComboBox>;
}
