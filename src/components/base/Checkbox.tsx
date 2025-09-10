import React from "react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helpText?: string;
    variant?:
        | "primary"
        | "secondary"
        | "accent"
        | "info"
        | "success"
        | "warning"
        | "error";
    checkboxSize?: "xs" | "sm" | "md" | "lg";
    labelPosition?: "left" | "right";
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    (
        {
            label,
            error,
            helpText,
            variant,
            checkboxSize,
            labelPosition = "left",
            className = "",
            ...props
        },
        ref,
    ) => {
        const baseClasses = "checkbox";
        const variantClasses = variant ? `checkbox-${variant}` : "";
        const sizeClasses = checkboxSize ? `checkbox-${checkboxSize}` : "";
        const errorClasses = error ? "checkbox-error" : "";

        const checkboxClasses = [
            baseClasses,
            variantClasses,
            sizeClasses,
            errorClasses,
            className,
        ]
            .filter(Boolean)
            .join(" ");

        const checkboxElement = (
            <input
                ref={ref}
                type="checkbox"
                className={checkboxClasses}
                {...props}
            />
        );

        if (!label && !error && !helpText) {
            return checkboxElement;
        }

        return (
            <div className="form-control">
                <label className="label cursor-pointer justify-start gap-2">
                    {labelPosition === "left" && label && (
                        <span className="label-text">{label}</span>
                    )}
                    {checkboxElement}
                    {labelPosition === "right" && label && (
                        <span className="label-text">{label}</span>
                    )}
                </label>
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

Checkbox.displayName = "Checkbox";

export default Checkbox;
