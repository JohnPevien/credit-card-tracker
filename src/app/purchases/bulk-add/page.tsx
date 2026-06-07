"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataService } from "@/lib/services/dataService";
import { CreditCard, Person } from "@/lib/supabase";
import BulkPurchaseForm from "@/components/purchases/BulkPurchaseForm";
import { LoadingSpinner } from "@/components/base";

export default function BulkAddPurchasesPage() {
    const router = useRouter();
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [persons, setPersons] = useState<Person[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadMetadata() {
            try {
                setIsLoading(true);
                setError(null);
                const [creditCardsData, personsData] = await Promise.all([
                    DataService.loadCreditCards(),
                    DataService.loadPersons(),
                ]);
                setCreditCards(creditCardsData);
                setPersons(personsData);
            } catch (err) {
                console.error("Failed to load metadata for bulk add:", err);
                setError("Failed to load credit cards or persons. Please try again.");
            } finally {
                setIsLoading(false);
            }
        }
        loadMetadata();
    }, []);

    const handleSubmit = async (purchases: Array<{
        credit_card_id: string;
        person_id: string;
        purchase_date: string;
        billing_start_date: string;
        total_amount: number;
        description: string;
        num_installments: number;
        is_bnpl: boolean;
    }>) => {
        try {
            await DataService.bulkCreatePurchasesWithTransactions(purchases);
            router.push("/purchases");
            router.refresh();
        } catch (error) {
            console.error("Error submitting bulk purchases:", error);
            throw error;
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-8 text-center">
                <LoadingSpinner />
                <p className="mt-2 text-gray-400">Loading forms and account details...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto space-y-6">
            <div className="mb-4">
                <Link href="/purchases" className="btn btn-ghost btn-sm gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Purchases
                </Link>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-4">
                <div>
                    <h1 className="heading-page">Bulk Add Purchases</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Add multiple purchases to the system in a single operation.
                    </p>
                </div>
            </div>

            {error ? (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            ) : (
                <BulkPurchaseForm
                    creditCards={creditCards}
                    persons={persons}
                    onSubmit={handleSubmit}
                    onCancel={() => router.push("/purchases")}
                />
            )}
        </div>
    );
}
