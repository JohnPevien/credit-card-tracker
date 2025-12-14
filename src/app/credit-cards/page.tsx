"use client";
import { useState, useEffect } from "react";
import { CreditCard, CreditCardInsert } from "@/lib/supabase";
import { CreditCardService } from "@/lib/services/creditCardService";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import CreditCardForm from "@/components/credit-cards/CreditCardForm";
import { LoadingSpinner } from "@/components/base";
import ActionButton from "@/components/base/ActionButton";
import { Edit3, Trash2 } from "lucide-react";

export default function CreditCardsPage() {
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [principalCards, setPrincipalCards] = useState<CreditCard[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            setIsLoading(true);
            setError(null);
            const loadedCards = await CreditCardService.loadCards();
            setCards(loadedCards);

            // Filter principal cards for the dropdown
            const principalOnly = loadedCards.filter(
                (card) => !card.is_supplementary,
            );
            setPrincipalCards(principalOnly);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load credit cards",
            );
            console.error("Error loading credit cards:", err);
        } finally {
            setIsLoading(false);
        }
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
        } catch {
            // Error is already logged in the service
        }
    }

    async function handleDelete(id: string) {
        if (confirm("Are you sure you want to delete this credit card?")) {
            try {
                await CreditCardService.deleteCard(id);
                loadCards();
            } catch {
                // Error is already logged in the service
            }
        }
    }

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return (
            <div className="container mx-auto p-4">
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
                <button onClick={loadCards} className="btn btn-primary mt-4">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="container space-y-5 mx-auto">
            <h1 className="heading-page">Credit Cards</h1>
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
                            <div className="flex gap-2 md:gap-3 items-center">
                                <ActionButton
                                    label="Edit"
                                    icon={<Edit3 className="w-4 h-4" />}
                                    variant="subtle"
                                    onClick={() => openEditModal(card)}
                                />
                                <ActionButton
                                    label="Delete"
                                    icon={<Trash2 className="w-4 h-4" />}
                                    variant="danger"
                                    onClick={() => handleDelete(card.id)}
                                />
                            </div>
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
