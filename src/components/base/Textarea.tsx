import React from "react";

interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
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
    textareaSize?: "xs" | "sm" | "md" | "lg";
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    (
        {
            label,
            error,
            helpText,
            variant = "bordered",
            textareaSize,
            className = "",
            ...props
        },
        ref,
    ) => {
        const baseClasses = "textarea w-full";
        const variantClasses = `textarea-${variant}`;
        const sizeClasses = textareaSize ? `textarea-${textareaSize}` : "";
        const errorClasses = error ? "textarea-error" : "";

        const textareaClasses = [
            baseClasses,
            variantClasses,
            sizeClasses,
            errorClasses,
            className,
        ]
            .filter(Boolean)
            .join(" ");

        const textareaElement = (
            <textarea ref={ref} className={textareaClasses} {...props} />
        );

        if (!label && !error && !helpText) {
            return textareaElement;
        }

        return (
            <div className="form-control w-full">
                {label && (
                    <div className="label">
                        <span className="label-text">{label}</span>
                    </div>
                )}
                {textareaElement}
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

Textarea.displayName = "Textarea";

export default Textarea;
