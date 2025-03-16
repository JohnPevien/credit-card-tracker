import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Credit Card Spending Tracker</h1>
        <p className="text-gray-600">Track your credit card transactions, installments, and BNPL purchases</p>
      </header>

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Getting Started</h2>
        <ol className="list-decimal pl-5 space-y-3">
          <li>
            <strong>Set up PocketBase:</strong> Download PocketBase from <a href="https://pocketbase.io/docs/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">pocketbase.io</a> and run it locally with <code className="bg-gray-100 p-1 rounded">./pocketbase serve</code>
          </li>
          <li>
            <strong>Create Collections:</strong> Access the Admin UI (usually at <code className="bg-gray-100 p-1 rounded">http://127.0.0.1:8090/_/</code>) and set up the following collections:
            <ul className="list-disc pl-5 mt-2">
              <li><strong>Persons</strong>: name (string)</li>
              <li><strong>Credit Cards</strong>: last_four_digits (string), cardholder_name (string), issuer (string)</li>
              <li><strong>Purchases</strong>: credit_card (relation), person (relation), purchase_date (date), total_amount (number), description (string), num_installments (number), is_bnpl (boolean)</li>
              <li><strong>Transactions</strong>: credit_card (relation), person (relation), date (date), amount (number), description (string), purchase (relation, optional)</li>
            </ul>
          </li>
          <li>
            <strong>Set Environment Variables:</strong> Create a <code className="bg-gray-100 p-1 rounded">.env.local</code> file with <code className="bg-gray-100 p-1 rounded">NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090</code>
          </li>
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link href="/credit-cards" className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-bold mb-2">Credit Cards</h2>
          <p className="text-gray-600">Manage your credit cards with their details</p>
        </Link>
        
        <Link href="/persons" className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-bold mb-2">Persons</h2>
          <p className="text-gray-600">Track who&apos;s using your credit cards</p>
        </Link>
        
        <Link href="/purchases" className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-bold mb-2">Purchases</h2>
          <p className="text-gray-600">Record purchases with installment options</p>
        </Link>
        
        <Link href="/transactions" className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-bold mb-2">Transactions</h2>
          <p className="text-gray-600">Track all transactions including payments</p>
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">How It Works</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Regular Purchase:</strong> Creates one Purchase record and one Transaction with the same date and amount.</li>
          <li><strong>Installment Purchase:</strong> Creates one Purchase record with multiple Transaction records (one per installment).</li>
          <li><strong>BNPL:</strong> Treated like an installment purchase, with the &quot;is_bnpl&quot; flag set to true.</li>
          <li><strong>Payment/Refund:</strong> A standalone Transaction with no purchase relation and a negative amount.</li>
        </ul>
      </div>
    </div>
  );
}
