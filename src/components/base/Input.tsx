import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helpText?: string;
    variant?:
        | "bordered"
        | "ghost"
        | "primary"
        | "secondary"
        | "accent"
        | "info"
        | "success"
        | "warning"
        | "error";
    inputSize?: "xs" | "sm" | "md" | "lg";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            error,
            helpText,
            variant = "bordered",
            inputSize,
            className = "",
            ...props
        },
        ref,
    ) => {
        const baseClasses = "input w-full";
        const variantClasses = `input-${variant}`;
        const sizeClasses = inputSize ? `input-${inputSize}` : "";
        const errorClasses = error ? "input-error" : "";

        const inputClasses = [
            baseClasses,
            variantClasses,
            sizeClasses,
            errorClasses,
            className,
        ]
            .filter(Boolean)
            .join(" ");

        const inputElement = (
            <input ref={ref} className={inputClasses} {...props} />
        );

        if (!label && !error && !helpText) {
            return inputElement;
        }

        return (
            <div className="form-control w-full">
                {label && (
                    <div className="label">
                        <span className="label-text">{label}</span>
                    </div>
                )}
                {inputElement}
                {(error || helpText) && (
                    <div className="label">
                        {error && (
                            <span className="label-text-alt text-error">
                                {error}
                            </span>
                        )}
                        {helpText && !error && (
                            <span className="label-text-alt">{helpText}</span>
                        )}
                    </div>
                )}
            </div>
        );
    },
);

Input.displayName = "Input";

export default Input;
