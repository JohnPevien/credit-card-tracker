import React, { ReactNode } from "react";

export interface DateInputProps
    extends Omit<
        React.InputHTMLAttributes<HTMLInputElement>,
        "size" | "onChange"
    > {
    name?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    variant?: "bordered" | "ghost";
    min?: string;
    max?: string;
    placeholder?: string;
    children?: ReactNode;
}

const INPUT_SIZE_CLASSES = {
    xs: "input-xs",
    sm: "input-sm",
    md: "input-md",
    lg: "input-lg",
    xl: "input-xl",
} as const;

const INPUT_VARIANT_CLASSES = {
    bordered: "input-bordered",
    ghost: "input-ghost",
} as const;

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
    (
        {
            name,
            value,
            onChange,
            required = false,
            disabled = false,
            className = "",
            size = "md",
            variant = "bordered",
            min,
            max,
            placeholder,

            ...props
        },
        ref,
    ) => {
        const sizeClass = INPUT_SIZE_CLASSES[size];
        const variantClass = INPUT_VARIANT_CLASSES[variant];

        return (
            <input
                ref={ref}
                type="date"
                name={name}
                value={value}
                onChange={onChange}
                required={required}
                disabled={disabled}
                min={min}
                max={max}
                placeholder={placeholder}
                className={`input ${variantClass} ${sizeClass} w-full ${className}`.trim()}
                {...props}
            />
        );
    },
);

DateInput.displayName = "DateInput";

export default DateInput;
