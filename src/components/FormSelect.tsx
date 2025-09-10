"use client";

import * as React from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface SelectOption {
    value: string;
    label: string;
}

interface FormSelectProps {
    name: string;
    value: string;
    options: SelectOption[] | string[];
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

export function FormSelect({
    name,
    value,
    options,
    onChange,
    placeholder = "Select an option",
    required = false,
    className,
}: FormSelectProps) {
    const handleValueChange = (newValue: string) => {
        // Create a synthetic event object that mimics a standard form event
        const syntheticEvent = {
            target: {
                name,
                value: newValue,
                type: "select",
            },
        } as unknown as React.ChangeEvent<HTMLSelectElement>;

        onChange(syntheticEvent);
    };

    // Format options to ensure they're in the correct format
    const formattedOptions = options.map((option) => {
        if (typeof option === "string") {
            return { value: option, label: option };
        }
        return option;
    });

    return (
        <Select
            value={value}
            onValueChange={handleValueChange}
            required={required}
        >
            <SelectTrigger className={className || "w-full p-2 border rounded"}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {formattedOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
