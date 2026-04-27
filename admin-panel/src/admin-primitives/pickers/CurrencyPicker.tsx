/** Currency picker — replaces the "type a 3-letter ISO 4217 code" input
 *  on custom-field forms (and anywhere else a currency code is needed).
 *
 *  Source: `/api/ui/currencies`, which returns the bounded ISO list.
 *  The component renders as a native <select> with an optional search
 *  filter for the long list; when the operator is just choosing among
 *  a handful, native UX wins (keyboard, accessibility, no extra deps). */

import * as React from "react";
import { useUiCurrencies } from "../../runtime/useUiMetadata";

export interface CurrencyPickerProps {
  value?: string;
  onChange: (code: string | undefined) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

export function CurrencyPicker({
  value,
  onChange,
  placeholder = "Select currency…",
  className,
  id,
  required,
}: CurrencyPickerProps): React.ReactElement {
  const { data: currencies, loading } = useUiCurrencies();
  return (
    <select
      id={id}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? undefined : v);
      }}
      required={required}
      className={["h-8 w-full rounded-md border border-border bg-surface-0 px-2 text-xs", className].filter(Boolean).join(" ")}
    >
      <option value="">{loading ? "Loading…" : placeholder}</option>
      {/* Always preserve the current value even if it's not in the
       *  shipping list — a tenant may have stored a code we don't
       *  enumerate (e.g. CLF). */}
      {value && !currencies.some((c) => c.code === value) && (
        <option value={value}>{value}</option>
      )}
      {currencies.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} — {c.name}
        </option>
      ))}
    </select>
  );
}
