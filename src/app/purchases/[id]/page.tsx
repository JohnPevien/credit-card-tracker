'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { pb, Purchase, Transaction } from '../../lib/pocketbase';

export default function PurchaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPurchaseData() {
      try {
        setLoading(true);
        
        // Load the purchase details with expanded relations
        const purchaseRecord = await pb.collection('purchases').getOne<Purchase>(id, {
          expand: 'credit_card,person'
        });
        setPurchase(purchaseRecord);
        
        // Load the related transactions
        const transactionsRecords = await pb.collection('transactions').getFullList<Transaction>({
          filter: `purchase="${id}"`,
          sort: 'date',
          expand: 'credit_card,person'
        });
        setTransactions(transactionsRecords);
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading purchase details:', error);
        setError('Failed to load purchase details');
        setLoading(false);
      }
    }

    if (id) {
      loadPurchaseData();
    }
  }, [id]);

  // Format date to a more readable format
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  if (loading) {
    return <div className="text-center p-8">Loading purchase details...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href="/purchases" className="text-blue-500 hover:underline">
          Back to Purchases
        </Link>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="text-center p-8">
        <p className="mb-4">Purchase not found</p>
        <Link href="/purchases" className="text-blue-500 hover:underline">
          Back to Purchases
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/purchases" className="text-blue-500 hover:underline">
          &larr; Back to Purchases
        </Link>
      </div>
      
      <h1 className="text-2xl font-bold mb-4">Purchase Details</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{purchase.description}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-gray-600">Date</p>
            <p className="font-medium">{formatDate(purchase.purchase_date)}</p>
          </div>
          <div>
            <p className="text-gray-600">Total Amount</p>
            <p className="font-medium">${purchase.total_amount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-600">Credit Card</p>
            <p className="font-medium">
              {purchase.expand?.credit_card ? (
                <span>
                  {purchase.expand.credit_card.credit_card_name || purchase.expand.credit_card.issuer} **** {purchase.expand.credit_card.last_four_digits}
                  {purchase.expand.credit_card.is_supplementary && (
                    <span className="text-sm text-gray-500 block">
                      Supplementary Card
                    </span>
                  )}
                </span>
              ) : (
                'Unknown Card'
              )}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Person</p>
            <p className="font-medium">
              {purchase.expand?.person ? purchase.expand.person.name : 'Unknown Person'}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Installments</p>
            <p className="font-medium">{purchase.num_installments}</p>
          </div>
          <div>
            <p className="text-gray-600">Buy Now Pay Later</p>
            <p className="font-medium">{purchase.is_bnpl ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>
      
      <h2 className="text-xl font-semibold mb-4">Transactions</h2>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Card</th>
              <th className="p-3 text-left">Person</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-3 text-center text-gray-500">No transactions found</td>
              </tr>
            ) : (
              transactions.map(transaction => (
                <tr key={transaction.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{formatDate(transaction.date)}</td>
                  <td className="p-3">{transaction.description}</td>
                  <td className="p-3">${transaction.amount.toFixed(2)}</td>
                  <td className="p-3">
                    {transaction.expand?.credit_card ? (
                      <span>
                        {transaction.expand.credit_card.credit_card_name || transaction.expand.credit_card.last_four_digits}
                        {transaction.expand.credit_card.is_supplementary && transaction.expand.credit_card.expand?.principal_card && (
                          <span className="text-xs text-gray-500 block">
                            (Supplementary)
                          </span>
                        )}
                      </span>
                    ) : (
                      'Unknown Card'
                    )}
                  </td>
                  <td className="p-3">
                    {transaction.expand?.person ? transaction.expand.person.name : ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
