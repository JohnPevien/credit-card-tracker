"use client";
import { useState, useEffect } from "react";
import { supabase, Person } from "../lib/supabase";
import DataTable from "@/components/DataTable";
import { personSchema } from "@/lib/schemas";
import { useZodForm } from "@/lib/hooks/useZodForm";

export default function PersonsPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const {
    values: formData,
    handleChange,
    errors,
    validate,
    reset,
    setValues,
  } = useZodForm(personSchema, {
    name: "",
  });

  useEffect(() => {
    loadPersons();
  }, []);

  async function loadPersons() {
    try {
      const { data, error } = await supabase.from("persons").select("*");

      if (error) throw error;
      setPersons(data || []);
    } catch (error) {
      console.error("Error loading persons:", error);
    }
  }

  function openAddModal() {
    reset({ name: "" });
    setEditingPerson(null);
    setIsModalOpen(true);
  }

  function openEditModal(person: Person) {
    setValues({ name: person.name });
    setEditingPerson(person);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate form data using Zod
    const isValid = validate();

    if (!isValid) {
      return;
    }

    try {
      if (editingPerson) {
        const { error } = await supabase
          .from("persons")
          .update({ name: formData.name })
          .eq("id", editingPerson.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("persons")
          .insert({ name: formData.name });

        if (error) throw error;
      }
      closeModal();
      loadPersons();
    } catch (error) {
      console.error("Error saving person:", error);
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this person?")) {
      try {
        const { error } = await supabase.from("persons").delete().eq("id", id);

        if (error) throw error;
        loadPersons();
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
            cell: (person) => (
              <>
                <button
                  onClick={() => openEditModal(person)}
                  className="mr-2 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(person.id)}
                  className="hover:underline"
                >
                  Delete
                </button>
              </>
            ),
          },
        ]}
      />

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingPerson ? "Edit Person" : "Add Person"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
                {errors.name && <p className="text-sm mt-1">{errors.name}</p>}
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
