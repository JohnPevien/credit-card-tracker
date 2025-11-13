"use client";
import { useState, useEffect } from "react";
import { Person } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import PersonForm from "@/components/persons/PersonForm";
import { PersonService } from "@/lib/services/personService";
import Link from "next/link";
import { LoadingSpinner } from "@/components/base";
import { Eye, Edit3, Trash2 } from "lucide-react";

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
                <LoadingSpinner />
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
                                <div className="flex gap-2 md:gap-3 items-center">
                                    <Link
                                        href={`/transactions/person/${person.id}`}
                                        className="btn btn-sm min-h-[44px] md:min-h-0 p-2 md:p-0 flex items-center gap-2"
                                    >
                                        <Eye className="w-4 h-4 md:hidden" />
                                        <span className="hidden md:inline">View Transactions</span>
                                    </Link>
                                    <button
                                        onClick={() => openEditModal(person)}
                                        className="btn btn-sm min-h-[44px] md:min-h-0 p-2 md:p-0 flex items-center gap-2"
                                    >
                                        <Edit3 className="w-4 h-4 md:hidden" />
                                        <span className="hidden md:inline">Edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(person.id)}
                                        className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0 p-2 md:p-0 flex items-center gap-2 text-red-600"
                                    >
                                        <Trash2 className="w-4 h-4 md:hidden" />
                                        <span className="hidden md:inline">Delete</span>
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
