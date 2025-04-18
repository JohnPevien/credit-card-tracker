import Link from "next/link";

export default function Home() {
  const navCards = [
    {
      href: "/credit-cards",
      title: "Credit Cards",
      description:
        "Manage your credit cards with their details, including supplementary cards",
    },
    {
      href: "/persons",
      title: "Persons",
      description: "Track who's using your credit cards",
    },
    {
      href: "/purchases",
      title: "Purchases",
      description: "Record purchases with installment options and BNPL",
    },
    {
      href: "/transactions",
      title: "Transactions",
      description: "Track all transactions including payments",
    },
  ];

  const howItWorksItems = [
    {
      title: "Regular Purchase",
      description:
        "Creates one purchase record and one transaction with the same date and amount.",
    },
    {
      title: "Installment Purchase",
      description:
        "Creates one purchase record with multiple transaction records (one per installment).",
    },
    {
      title: "BNPL",
      description:
        'Treated like an installment purchase, with the "is_bnpl" flag set to true.',
    },
    {
      title: "Payment/Refund",
      description:
        "A standalone transaction with no purchase relation and a negative amount.",
    },
    {
      title: "Supplementary Cards",
      description: "Linked to their principal cards for better organization.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">
          Credit Card Spending Tracker
        </h1>
        <p>
          Track your credit card transactions, installments, and BNPL purchases
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {navCards.map((card, index) => (
          <Link
            key={index}
            href={card.href}
            className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-bold mb-2 text-gray-800">
              {card.title}
            </h2>
            <p className="text-gray-800">{card.description}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">How It Works</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-800">
          {howItWorksItems.map((item, index) => (
            <li key={index}>
              <strong className="text-gray-800">{item.title}:</strong>
              {item.title === "Supplementary Cards" || item.title === "BNPL"
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
