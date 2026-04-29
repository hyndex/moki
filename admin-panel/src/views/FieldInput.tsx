import * as React from "react";
import { Input } from "@/primitives/Input";
import { Textarea } from "@/primitives/Textarea";
import { Checkbox } from "@/primitives/Checkbox";
import { Switch } from "@/primitives/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/primitives/Select";
import type { FieldDescriptor } from "@/contracts/fields";
import { getFieldKindRenderer } from "./fieldKindRegistry";
// Side-effect import: registers the built-in advanced field kinds
// (image, file, geo, color, tags, …) into the registry. Tree-shakable —
// pages that never reach FieldInput pay nothing for it.
import "./field-kinds/registerAll";

export interface FieldInputProps {
  field: FieldDescriptor;
  value: unknown;
  onChange: (v: unknown) => void;
  record: Record<string, unknown>;
  invalid?: boolean;
  disabled?: boolean;
  /** DOM id for the underlying control. Required for `<label htmlFor>`
   *  pairing — FormView passes a deterministic id derived from the form
   *  + field name. */
  id?: string;
}

export function FieldInput({
  field,
  value,
  onChange,
  record,
  invalid,
  disabled,
  id,
}: FieldInputProps) {
  const readOnly = disabled || field.readonly;
  const required = !!field.required;
  const ariaInvalid = invalid ? true : undefined;
  if (field.render) {
    return <>{field.render({ value, record, onChange, invalid, disabled: readOnly })}</>;
  }

  // Field-kind registry takes precedence — new advanced kinds (image,
  // geo, video, …) ship as registered renderers, NOT as new switch
  // cases. The legacy switch below is kept verbatim for built-in kinds
  // so existing pages stay byte-identical.
  const registered = getFieldKindRenderer(field.kind);
  if (registered?.Form) {
    const Form = registered.Form;
    return (
      <Form
        field={field}
        value={value}
        onChange={onChange}
        record={record}
        invalid={invalid}
        disabled={readOnly}
        readOnly={readOnly}
      />
    );
  }

  switch (field.kind) {
    case "textarea":
      return (
        <Textarea
          id={id}
          name={field.name}
          required={required}
          aria-invalid={ariaInvalid}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          invalid={invalid}
          disabled={readOnly}
        />
      );
    case "number":
    case "currency":
      return (
        <Input
          id={id}
          name={field.name}
          required={required}
          aria-invalid={ariaInvalid}
          type="number"
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          placeholder={field.placeholder}
          invalid={invalid}
          disabled={readOnly}
        />
      );
    case "email":
      return (
        <Input
          id={id}
          name={field.name}
          required={required}
          aria-invalid={ariaInvalid}
          type="email"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          invalid={invalid}
          disabled={readOnly}
        />
      );
    case "url":
      return (
        <Input
          id={id}
          name={field.name}
          required={required}
          aria-invalid={ariaInvalid}
          type="url"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          invalid={invalid}
          disabled={readOnly}
        />
      );
    case "phone":
      return (
        <Input
          id={id}
          name={field.name}
          required={required}
          aria-invalid={ariaInvalid}
          type="tel"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          invalid={invalid}
          disabled={readOnly}
        />
      );
    case "date":
      return (
        <Input
          id={id}
          name={field.name}
          required={required}
          aria-invalid={ariaInvalid}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          invalid={invalid}
          disabled={readOnly}
        />
      );
    case "datetime":
      return (
        <Input
          id={id}
          name={field.name}
          required={required}
          aria-invalid={ariaInvalid}
          type="datetime-local"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          invalid={invalid}
          disabled={readOnly}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2 h-field-h">
          <Switch
            id={id}
            checked={!!value}
            onCheckedChange={(v) => onChange(v)}
            disabled={readOnly}
            aria-invalid={ariaInvalid}
          />
          <span className="text-sm text-text-secondary">
            {value ? "Enabled" : "Disabled"}
          </span>
        </div>
      );
    case "enum":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v)}
          disabled={readOnly}
        >
          <SelectTrigger id={id} aria-invalid={ariaInvalid} invalid={invalid}>
            <SelectValue placeholder={field.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multi-enum":
      return (
        <div className="flex flex-col gap-1.5">
          {field.options?.map((opt) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const checked = arr.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="inline-flex items-center gap-2 text-sm text-text-primary cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => {
                    const next = new Set(arr);
                    checked ? next.delete(opt.value) : next.add(opt.value);
                    onChange(Array.from(next));
                  }}
                  disabled={readOnly}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      );
    case "json":
      return (
        <Textarea
          id={id}
          name={field.name}
          required={required}
          aria-invalid={ariaInvalid}
          rows={6}
          className="font-mono text-xs"
          value={
            typeof value === "string"
              ? value
              : value == null
                ? ""
                : JSON.stringify(value, null, 2)
          }
          onChange={(e) => onChange(e.target.value)}
          invalid={invalid}
          disabled={readOnly}
        />
      );
    case "text":
    default:
      return (
        <Input
          id={id}
          name={field.name}
          required={required}
          aria-invalid={ariaInvalid}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          invalid={invalid}
          disabled={readOnly}
        />
      );
  }
}
