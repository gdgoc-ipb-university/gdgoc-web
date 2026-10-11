"use client";

import type { ReactNode } from "react";
import { Button, FieldError, Label, ListBox, ListBoxItem, Popover, Select as AriaSelect, SelectValue, Text } from "react-aria-components/Select";
import { PixelIcon } from "./pixel-icons";

export type SelectOption<K extends string | number> = { value: K; label: string };

type Props<K extends string | number> = {
  /** Set on the trigger, so a `#id` link or focus call lands on the control. */
  id?: string;
  label: ReactNode;
  value: K | "";
  onChange: (value: K) => void;
  options: readonly SelectOption<K>[];
  /** Shown while nothing is chosen; picking it again is not possible, as with a required native select. */
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** Submits the value with a surrounding form, through a hidden native select. */
  name?: string;
  /** `inline` puts a small label beside a compact control, e.g. rows per page. */
  variant?: "field" | "inline";
  className?: string;
};

/**
 * The one select of the site: a field-styled button that opens a listbox (React Aria), so every choice list looks
 * and behaves the same on every browser. Keyboard, typeahead, and screen readers work as with a native select.
 */
export function Select<K extends string | number>({ id, label, value, onChange, options, placeholder = "Pilih salah satu", hint, error, required, disabled, name, variant = "field", className = "" }: Props<K>) {
  return <AriaSelect
    className={`select-field ${variant === "field" ? "app-field" : "select-inline"} ${className}`.trim()}
    value={value === "" ? null : value} onChange={(key) => { if (key !== null) onChange(key as K); }}
    placeholder={placeholder} isDisabled={disabled} isRequired={required} isInvalid={Boolean(error)} validationBehavior="aria" name={name}
  >
    <Label className="select-label">{label}</Label>
    <Button id={id} className="select-trigger">
      <SelectValue className="select-value" />
      <PixelIcon name="chevron-down" size={18} className="select-chevron" />
    </Button>
    {hint && <Text slot="description" className="field-hint">{hint}</Text>}
    <FieldError className="field-error">{error}</FieldError>
    <Popover className="select-popover" offset={6} data-lenis-prevent>
      <ListBox className="select-list">
        {options.map((option) => <ListBoxItem key={option.value} id={option.value} textValue={option.label} className="select-option">
          {({ isSelected }) => <><span>{option.label}</span>{isSelected && <PixelIcon name="check" size={18} />}</>}
        </ListBoxItem>)}
      </ListBox>
    </Popover>
  </AriaSelect>;
}
