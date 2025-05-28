"use client";
import { useState, useEffect } from "react";
import { supabase, CreditCard } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { FormSelect } from "@/components/FormSelect";
import { refinedCreditCardSchema } from "@/lib/schemas";
import { useZodForm } from "@/lib/hooks/useZodForm";

export default function CreditCardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [principalCards, setPrincipalCards] = useState<CreditCard[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);

  // Common banks in the Philippines
  const philippineBanks = [
    "BDO",
    "BPI",
    "Metrobank",
    "PNB",
    "Security Bank",
    "UnionBank",
    "RCBC",
    "Eastwest Bank",
    "Citibank",
    "HSBC",
    "Maybank",
    "China Bank",
  ];

  const {
    values: formData,
    setValues: setFormData,
    errors,
    handleChange,
    validate,
    reset,
  } = useZodForm(refinedCreditCardSchema, {
    credit_card_name: "",
    last_four_digits: "",
    cardholder_name: "",
    issuer: "",
    is_supplementary: false,
    principal_card_id: "",
  });

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    try {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("*, principal_card:principal_card_id(*)");

      if (error) throw error;

      // Transform data to match the expected format with expand property
      const recordsWithExpand =
        data?.map((card) => ({
          ...card,
          expand: {
            principal_card: card.principal_card,
          },
        })) || [];

      setCards(recordsWithExpand);

      // Filter principal cards for the dropdown
      const principalOnly = recordsWithExpand.filter(
        (card) => !card.is_supplementary
      );
      setPrincipalCards(principalOnly);
    } catch (error) {
      console.error("Error loading credit cards:", error);
    }
  }

  function openAddModal() {
    reset({
      credit_card_name: "",
      last_four_digits: "",
      cardholder_name: "",
      issuer: "",
      is_supplementary: false,
      principal_card_id: "",
    });
    setEditingCard(null);
    setIsAddModalOpen(true);
  }

  function openEditModal(card: CreditCard) {
    setFormData({
      credit_card_name: card.credit_card_name || "",
      last_four_digits: card.last_four_digits,
      cardholder_name: card.cardholder_name,
      issuer: card.issuer,
      is_supplementary: card.is_supplementary || false,
      principal_card_id: card.principal_card_id || "",
    });
    setEditingCard(card);
    setIsAddModalOpen(true);
  }

  function closeModal() {
    setIsAddModalOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate form data using Zod
    const isValid = validate();

    if (!isValid) {
      return;
    }

    // If not supplementary, ensure principal_card_id is null
    const submitData = {
      ...formData,
      principal_card_id: formData.is_supplementary
        ? formData.principal_card_id
        : null,
    };

    try {
      if (editingCard) {
        const { error } = await supabase
          .from("credit_cards")
          .update(submitData)
          .eq("id", editingCard.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("credit_cards")
          .insert(submitData);

        if (error) throw error;
      }
      closeModal();
      loadCards();
    } catch (error) {
      console.error("Error saving credit card:", error);
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this credit card?")) {
      try {
        const { error } = await supabase
          .from("credit_cards")
          .delete()
          .eq("id", id);

        if (error) throw error;
        loadCards();
      } catch (error) {
        console.error("Error deleting credit card:", error);
      }
    }
  }

  return (
    <div className="container space-y-5 mx-auto">
      <h1 className="text-2xl font-bold mb-4">Credit Cards</h1>
      <button onClick={openAddModal} className="btn btn-primary">
        Add Credit Card
      </button>

      <DataTable
        data={cards}
        keyField="id"
        emptyMessage="No credit cards found"
        columns={[
          {
            header: "Card Name",
            accessorKey: "credit_card_name",
          },
          {
            header: "Last 4 Digits",
            accessorKey: "last_four_digits",
          },
          {
            header: "Cardholder",
            accessorKey: "cardholder_name",
          },
          {
            header: "Issuer",
            accessorKey: "issuer",
          },
          {
            header: "Type",
            cell: (card) =>
              card.is_supplementary ? "Supplementary" : "Principal",
          },
          {
            header: "Principal Card",
            cell: (card) =>
              card.is_supplementary && card.expand?.principal_card
                ? card.expand.principal_card.credit_card_name
                : "-",
          },
          {
            header: "Actions",
            cell: (card) => (
              <>
                <button
                  onClick={() => openEditModal(card)}
                  className="text-blue-500 hover:text-blue-700 mr-2"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(card.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </>
            ),
          },
        ]}
      />

      {isAddModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className=" p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingCard ? "Edit Credit Card" : "Add Credit Card"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block mb-1">Card Name</label>
                <input
                  type="text"
                  name="credit_card_name"
                  value={formData.credit_card_name}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
                {errors.credit_card_name && (
                  <p className="text-sm mt-1">{errors.credit_card_name}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block mb-1">Last 4 Digits</label>
                <input
                  type="text"
                  name="last_four_digits"
                  value={formData.last_four_digits}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  maxLength={4}
                />
                {errors.last_four_digits && (
                  <p className="text-sm mt-1">{errors.last_four_digits}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block mb-1">Cardholder Name</label>
                <input
                  type="text"
                  name="cardholder_name"
                  value={formData.cardholder_name}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
                {errors.cardholder_name && (
                  <p className="text-sm mt-1">{errors.cardholder_name}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block mb-1">Issuer</label>
                <FormSelect
                  name="issuer"
                  value={formData.issuer}
                  onChange={handleChange}
                  options={philippineBanks.map((bank) => ({
                    value: bank,
                    label: bank,
                  }))}
                  placeholder="Select issuer"
                  className="w-full"
                />
                {errors.issuer && (
                  <p className="text-sm mt-1">{errors.issuer}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_supplementary"
                    checked={formData.is_supplementary}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  Supplementary Card
                </label>
              </div>

              {formData.is_supplementary && (
                <div className="mb-4">
                  <label className="block mb-1">Principal Card</label>
                  <FormSelect
                    name="principal_card_id"
                    value={formData.principal_card_id}
                    onChange={handleChange}
                    options={principalCards.map((card) => ({
                      value: card.id,
                      label: `${card.credit_card_name} (${card.last_four_digits})`,
                    }))}
                    placeholder="Select principal card"
                    className="w-full"
                  />
                  {errors.principal_card_id && (
                    <p className="text-sm mt-1">{errors.principal_card_id}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary"
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
