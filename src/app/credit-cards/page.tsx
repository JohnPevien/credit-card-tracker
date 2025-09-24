"use client";
import { useState, useEffect } from "react";
import { CreditCard, CreditCardInsert } from "@/lib/supabase";
import { CreditCardService } from "@/lib/services/creditCardService";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import CreditCardForm from "@/components/credit-cards/CreditCardForm";
import { PHILIPPINE_BANKS } from "@/lib/constants";
import { ActionButtons } from "@/components/base";

export default function CreditCardsPage() {
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [principalCards, setPrincipalCards] = useState<CreditCard[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<CreditCard | null>(null);

    const initialFormData: CreditCardInsert = {
        credit_card_name: "",
        last_four_digits: "",
        cardholder_name: "",
        issuer: "",
        is_supplementary: false,
        principal_card_id: "",
    };

    useEffect(() => {
        loadCards();
    }, []);

    async function loadCards() {
        try {
            const loadedCards = await CreditCardService.loadCards();
            setCards(loadedCards);

            // Filter principal cards for the dropdown
            const principalOnly = loadedCards.filter(
                (card) => !card.is_supplementary,
            );
            setPrincipalCards(principalOnly);
        } catch (error) {}
    }

    function openAddModal() {
        setEditingCard(null);
        setIsAddModalOpen(true);
    }

    function openEditModal(card: CreditCard) {
        setEditingCard(card);
        setIsAddModalOpen(true);
    }

    function closeModal() {
        setIsAddModalOpen(false);
    }

    async function handleSubmit(formData: CreditCardInsert) {
        try {
            if (editingCard) {
                await CreditCardService.updateCard(editingCard.id, formData);
            } else {
                await CreditCardService.createCard(formData);
            }
            closeModal();
            loadCards();
        } catch (error) {
            // Error is already logged in the service
        }
    }

    async function handleDelete(id: string) {
        if (confirm("Are you sure you want to delete this credit card?")) {
            try {
                await CreditCardService.deleteCard(id);
                loadCards();
            } catch (error) {
                // Error is already logged in the service
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
                            card.is_supplementary
                                ? "Supplementary"
                                : "Principal",
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
            />{" "}
            <Modal
                isOpen={isAddModalOpen}
                onClose={closeModal}
                title={editingCard ? "Edit Credit Card" : "Add Credit Card"}
            >
                <CreditCardForm
                    onSubmit={handleSubmit}
                    onCancel={closeModal}
                    initialData={editingCard || initialFormData}
                    principalCards={principalCards}
                />
            </Modal>
        </div>
    );
}
