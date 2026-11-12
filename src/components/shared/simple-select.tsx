"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SimpleSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  /** Accessible name. Required when there is no visible <label htmlFor>. */
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  size?: "sm" | "default";
  className?: string;
}

/** Single-choice dropdown over a fixed list of string options. */
export function SimpleSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  id,
  disabled,
  invalid,
  size = "default",
  className,
}: SimpleSelectProps<T>) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn("w-full bg-white", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" className="min-w-44">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
