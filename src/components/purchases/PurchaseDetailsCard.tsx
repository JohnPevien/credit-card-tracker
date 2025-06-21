import { Purchase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

interface PurchaseDetailsCardProps {
    purchase: Purchase;
}

export default function PurchaseDetailsCard({
    purchase,
}: PurchaseDetailsCardProps) {
    return (
        <div className="rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
                {purchase.description}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <p>Date</p>
                    <p className="font-medium">
                        {formatDate(purchase.purchase_date)}
                    </p>
                </div>
                <div>
                    <p>Total Amount</p>
                    <p className="font-medium">
                        ${purchase.total_amount.toFixed(2)}
                    </p>
                </div>
                <div>
                    <p>Credit Card</p>
                    <p className="font-medium">
                        {purchase.expand?.credit_card ? (
                            <span>
                                {purchase.expand.credit_card.credit_card_name ||
                                    purchase.expand.credit_card.issuer}{" "}
                                ****{" "}
                                {purchase.expand.credit_card.last_four_digits}
                                {purchase.expand.credit_card
                                    .is_supplementary && (
                                    <span className="text-sm block">
                                        Supplementary Card
                                    </span>
                                )}
                            </span>
                        ) : (
                            "Unknown Card"
                        )}
                    </p>
                </div>
                <div>
                    <p>Person</p>
                    <p className="font-medium">
                        {purchase.expand?.person
                            ? purchase.expand.person.name
                            : "Unknown Person"}
                    </p>
                </div>
                <div>
                    <p>Installments</p>
                    <p className="font-medium">{purchase.num_installments}</p>
                </div>
                <div>
                    <p>Buy Now Pay Later</p>
                    <p className="font-medium">
                        {purchase.is_bnpl ? "Yes" : "No"}
                    </p>
                </div>
            </div>
        </div>
    );
}
