import Link from "next/link";
import { NAV_CARDS, HOW_IT_WORKS_ITEMS } from "@/lib/constants";
import { Card } from "@/components/base";

export default function Home() {
    const navCards = NAV_CARDS;
    const howItWorksItems = HOW_IT_WORKS_ITEMS;

    return (
        <div className="max-w-4xl mx-auto">
            <header className="mb-8 text-center">
                <h1 className="heading-hero">Credit Card Spending Tracker</h1>
                <p>
                    Track your credit card transactions, installments, and BNPL
                    purchases
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {navCards.map((card) => (
                    <Link key={card.id} href={card.href}>
                        <Card variant="primary" hover>
                            <Card.Header>{card.title}</Card.Header>
                            <Card.Body>
                                <p>{card.description}</p>
                            </Card.Body>
                        </Card>
                    </Link>
                ))}
            </div>

            <Card>
                <Card.Header>How It Works</Card.Header>
                <Card.Body>
                    <ul className="list-disc pl-5 space-y-2">
                        {howItWorksItems.map((item) => (
                            <li key={item.id}>
                                <strong>{item.title}:</strong>{" "}
                                {item.description}
                            </li>
                        ))}
                    </ul>
                </Card.Body>
            </Card>
        </div>
    );
}
