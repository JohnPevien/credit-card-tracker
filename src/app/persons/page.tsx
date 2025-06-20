"use client";
import { useState, useEffect } from "react";
import { Person } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import PersonForm from "@/components/persons/PersonForm";
import { PersonService } from "@/lib/services/personService";
import Link from "next/link";

export default function PersonsPage() {
    const [persons, setPersons] = useState<Person[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadPersons();
    }, []);

    async function loadPersons() {
        try {
            setIsLoading(true);
            const data = await PersonService.loadPersons();
            setPersons(data);
        } catch (error) {
            console.error("Error loading persons:", error);
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
            <h1 className="text-2xl font-bold mb-4">Persons</h1>
            <button onClick={openAddModal} className="btn btn-primary">
                Add Person
            </button>

            {isLoading ? (
                <div>Loading...</div>
            ) : (
                <DataTable
                    data={persons}
                    keyField="id"
                    emptyMessage="No persons found"
                    columns={[
                        {
                            header: "Name",
                            accessorKey: "name",
                        },
                        {
                            header: "Actions",
                            className: "w-[200px]",
                            cell: (person: Person) => (
                                <div className="flex space-x-2">
                                    <Link
                                        href={`/transactions/person/${person.id}`}
                                        className="hover:underline"
                                    >
                                        View Transactions
                                    </Link>
                                    <button
                                        onClick={() => openEditModal(person)}
                                        className="hover:underline"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(person.id)}
                                        className="hover:underline"
                                    >
                                        Delete
                                    </button>
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
