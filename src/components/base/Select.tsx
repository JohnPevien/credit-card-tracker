import { ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "bordered" | "ghost";
  children?: ReactNode;
}

const SELECT_SIZE_CLASSES = {
  xs: "select-xs",
  sm: "select-sm", 
  md: "select-md",
  lg: "select-lg",
  xl: "select-xl",
};

const SELECT_VARIANT_CLASSES = {
  bordered: "select-bordered",
  ghost: "select-ghost",
};

export default function Select({
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  disabled = false,
  className = "",
  size = "md",
  variant = "bordered",
  children,
}: SelectProps) {
  const sizeClass = SELECT_SIZE_CLASSES[size];
  const variantClass = SELECT_VARIANT_CLASSES[variant];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <select
      name={name}
      value={value}
      onChange={handleChange}
      required={required}
      disabled={disabled}
      className={`select ${variantClass} ${sizeClass} w-full ${className}`.trim()}
    >
      {placeholder && (
        <option value="" disabled={required}>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {children}
    </select>
  );
}
