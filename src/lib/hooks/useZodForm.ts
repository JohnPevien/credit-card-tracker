import { useState } from "react";
import { z } from "zod";

export function useZodForm<T extends z.ZodType>(
    schema: T,
    initialValues: z.infer<T>,
) {
    // State for form values
    const [values, setValues] = useState<z.infer<T>>(initialValues);

    // State for validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Handle input changes
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value, type } = e.target as HTMLInputElement;

        // Handle checkbox inputs
        if (type === "checkbox") {
            const checked = (e.target as HTMLInputElement).checked;
            setValues((prev) => ({ ...prev, [name]: checked }));
        }
        // Handle number inputs
        else if (type === "number") {
            setValues((prev) => ({ ...prev, [name]: Number(value) }));
        }
        // Handle all other inputs
        else {
            setValues((prev) => ({ ...prev, [name]: value }));
        }

        // Clear error for this field when user makes changes
        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    // Validate the form
    const validate = (): boolean => {
        try {
            schema.parse(values);
            setErrors({});
            return true;
        } catch (error) {
            if (error instanceof z.ZodError) {
                const newErrors: Record<string, string> = {};
                error.errors.forEach((err) => {
                    if (err.path[0]) {
                        newErrors[err.path[0].toString()] = err.message;
                    }
                });
                setErrors(newErrors);
            }
            return false;
        }
    };

    // Reset the form
    const reset = (newValues: z.infer<T> = initialValues) => {
        setValues(newValues);
        setErrors({});
    };

    return {
        values,
        setValues,
        errors,
        handleChange,
        validate,
        reset,
    };
}
