import { useState, useEffect, useMemo } from "react";
import Modal from "@/components/Modal";
import { personSchema } from "@/lib/schemas";
import { useZodForm } from "@/lib/hooks/useZodForm";
import { Person } from "@/lib/supabase";

interface PersonFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string }) => Promise<void>;
    initialData?: Person | null;
}

export default function PersonForm({
    isOpen,
    onClose,
    onSubmit,
    initialData,
}: PersonFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const initialFormValues = useMemo(() => ({ name: "" }), []);

    const {
        values: formData,
        handleChange,
        errors,
        validate,
        reset,
        setValues,
    } = useZodForm(personSchema, initialFormValues);

    useEffect(() => {
        if (initialData) {
            setValues({ name: initialData.name });
        } else {
            reset({ name: "" });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData?.id]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const isValid = validate();
        if (!isValid) return;

        setIsSubmitting(true);
        try {
            await onSubmit(formData);
            reset({ name: "" });
            onClose();
        } catch (error) {
            console.error("Error submitting form:", error);
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleClose() {
        reset({ name: "" });
        onClose();
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={initialData ? "Edit Person" : "Add Person"}
        >
            <form onSubmit={handleSubmit} data-component="PersonForm">
                <div className="mb-4">
                    <label className="block mb-1">Name</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                        disabled={isSubmitting}
                    />
                    {errors.name && (
                        <p className="text-sm mt-1 text-red-600">
                            {errors.name}
                        </p>
                    )}
                </div>
                <div className="flex justify-end space-x-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 border rounded"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Saving..." : "Save"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
