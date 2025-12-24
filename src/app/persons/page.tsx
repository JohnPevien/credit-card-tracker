"use client";
import { useState, useEffect } from "react";
import { Person } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import PersonForm from "@/components/persons/PersonForm";
import { PersonService } from "@/lib/services/personService";
import { LoadingSpinner } from "@/components/base";
import ActionButton from "@/components/base/ActionButton";
import { Eye, Edit3, Trash2 } from "lucide-react";

export default function PersonsPage() {
    const [persons, setPersons] = useState<Person[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadPersons();
    }, []);

    async function loadPersons() {
        try {
            setIsLoading(true);
            setError(null);
            const data = await PersonService.loadPersons();
            setPersons(data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load persons",
            );
            console.error("Error loading persons:", err);
        } finally {
            setIsLoading(false);
        }
    }

    function openAddModal() {
        setEditingPerson(null);
        setIsModalOpen(true);
    }

    function openEditModal(person: Person) {
        setEditingPerson(person);
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setEditingPerson(null);
    }

    async function handleFormSubmit(data: { name: string }) {
        try {
            if (editingPerson) {
                await PersonService.updatePerson(editingPerson.id, data);
            } else {
                await PersonService.addPerson(data);
            }
            await loadPersons();
        } catch (error) {
            console.error("Error saving person:", error);
            throw error;
        }
    }

    async function handleDelete(id: string) {
        if (confirm("Are you sure you want to delete this person?")) {
            try {
                await PersonService.deletePerson(id);
                await loadPersons();
            } catch (error) {
                console.error("Error deleting person:", error);
            }
        }
    }
    return (
        <div className="container space-y-5 mx-auto">
            <h1 className="heading-page">Persons</h1>
            <button onClick={openAddModal} className="btn btn-primary">
                Add Person
            </button>

            {isLoading ? (
                <LoadingSpinner />
            ) : error ? (
                <div>
                    <div className="alert alert-error">
                        <span>{error}</span>
                    </div>
                    <button
                        onClick={loadPersons}
                        className="btn btn-primary mt-4"
                    >
                        Retry
                    </button>
                </div>
            ) : (
                <DataTable
                    data={persons}
                    keyField="id"
                    emptyMessage="No persons yet. Add a person to track their transactions."
                    columns={[
                        {
                            header: "Name",
                            accessorKey: "name",
                        },
                        {
                            header: "Actions",
                            className: "w-[200px]",
                            cell: (person: Person) => (
                                <div className="flex gap-2 md:gap-3 items-center">
                                    <ActionButton
                                        label="View Transactions"
                                        icon={<Eye className="w-4 h-4" />}
                                        variant="outline"
                                        href={`/transactions/person/${person.slug}`}
                                    />
                                    <ActionButton
                                        label="Edit"
                                        icon={<Edit3 className="w-4 h-4" />}
                                        variant="subtle"
                                        onClick={() => openEditModal(person)}
                                    />
                                    <ActionButton
                                        label="Delete"
                                        icon={<Trash2 className="w-4 h-4" />}
                                        variant="danger"
                                        onClick={() => handleDelete(person.id)}
                                    />
                                </div>
                            ),
                        },
                    ]}
                />
            )}

            <PersonForm
                isOpen={isModalOpen}
                onClose={closeModal}
                onSubmit={handleFormSubmit}
                initialData={editingPerson}
            />
        </div>
    );
}
