import Link from "next/link";

export default function Home() {
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
        <Link
          href="/credit-cards"
          className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-bold mb-2 text-gray-800">Credit Cards</h2>
          <p className="text-gray-800">
            Manage your credit cards with their details, including supplementary
            cards
          </p>
        </Link>

        <Link
          href="/persons"
          className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-bold mb-2 text-gray-800">Persons</h2>
          <p className="text-gray-800">
            Track who&apos;s using your credit cards
          </p>
        </Link>

        <Link
          href="/purchases"
          className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-bold mb-2 text-gray-800">Purchases</h2>
          <p className="text-gray-800">
            Record purchases with installment options and BNPL
          </p>
        </Link>

        <Link
          href="/transactions"
          className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-bold mb-2 text-gray-800">Transactions</h2>
          <p className="text-gray-800">
            Track all transactions including payments
          </p>
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">How It Works</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-800">
          <li>
            <strong className="text-gray-800">Regular Purchase:</strong> Creates
            one purchase record and one transaction with the same date and
            amount.
          </li>
          <li>
            <strong className="text-gray-800">Installment Purchase:</strong>{" "}
            Creates one purchase record with multiple transaction records (one
            per installment).
          </li>
          <li>
            <strong className="text-gray-800">BNPL:</strong> Treated like an
            installment purchase, with the &quot;is_bnpl&quot; flag set to true.
          </li>
          <li>
            <strong className="text-gray-800">Payment/Refund:</strong> A
            standalone transaction with no purchase relation and a negative
            amount.
          </li>
          <li>
            <strong className="text-gray-800">Supplementary Cards:</strong>{" "}
            Linked to their principal cards for better organization.
          </li>
        </ul>
      </div>
    </div>
  );
}
