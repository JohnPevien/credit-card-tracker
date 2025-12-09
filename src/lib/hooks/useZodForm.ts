import { useState, useCallback, useRef, useEffect } from "react";
import { z } from "zod";

export function useZodForm<T extends z.ZodType>(
    schema: T,
    initialValues: z.infer<T>,
) {
    const initialValuesRef = useRef(initialValues);

    useEffect(() => {
        initialValuesRef.current = initialValues;
    }, [initialValues]);

    const [values, setValues] = useState<z.infer<T>>(initialValues);

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Stable setValues function
    const setValuesCallback = useCallback(
        (newValues: z.infer<T> | ((prev: z.infer<T>) => z.infer<T>)) => {
            setValues(newValues);
        },
        [],
    );

    // Handle input changes
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
            setErrors((prev) => {
                if (!prev[name]) return prev;
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        },
        [],
    );

    // Validate the form
    const validate = useCallback((): boolean => {
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
    }, [schema, values]);

    const reset = useCallback((newValues?: z.infer<T>) => {
        setValues(newValues ?? initialValuesRef.current);
        setErrors({});
    }, []);

    return {
        values,
        setValues: setValuesCallback,
        errors,
        handleChange,
        validate,
        reset,
    };
}
