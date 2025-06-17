import Link from "next/link";
import { NAV_CARDS, HOW_IT_WORKS_ITEMS } from "@/lib/constants";

export default function Home() {
    const navCards = NAV_CARDS;
    const howItWorksItems = HOW_IT_WORKS_ITEMS;

    return (
        <div className="max-w-4xl mx-auto">
            <header className="mb-8 text-center">
                <h1 className="text-3xl font-bold mb-2">
                    Credit Card Spending Tracker
                </h1>
                <p>
                    Track your credit card transactions, installments, and BNPL
                    purchases
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {navCards.map((card, index) => (
                    <Link
                        key={index}
                        href={card.href}
                        className="shadow bg-primary rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                        <h2 className="text-xl font-bold mb-2 ">
                            {card.title}
                        </h2>
                        <p className="">{card.description}</p>
                    </Link>
                ))}
            </div>

            <div className=" shadow rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4 ">How It Works</h2>
                <ul className="list-disc pl-5 space-y-2 ">
                    {howItWorksItems.map((item, index) => (
                        <li key={index}>
                            <strong className="">{item.title}:</strong>
                            {item.title === "Supplementary Cards" ||
                            item.title === "BNPL"
                                ? " "
                                : " "}
                            {item.description}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
