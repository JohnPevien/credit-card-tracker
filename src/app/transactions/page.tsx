'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { pb, Transaction, CreditCard, Person } from '../lib/pocketbase';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [formData, setFormData] = useState({
    credit_card: '',
    person: '',
    date: '',
    amount: '',
    description: '',
    purchase: ''
  });

  useEffect(() => {
    loadTransactions();
    loadCreditCards();
    loadPersons();
  }, []);

  async function loadTransactions() {
    try {
      const records = await pb.collection('transactions').getFullList<Transaction>({
        expand: 'credit_card,person,purchase',
        sort: '-date'
      });
      setTransactions(records);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }

  async function loadCreditCards() {
    try {
      const records = await pb.collection('credit_cards').getFullList<CreditCard>({
        expand: 'principal_card'
      });
      setCreditCards(records);
    } catch (error) {
      console.error('Error loading credit cards:', error);
    }
  }

  async function loadPersons() {
    try {
      const records = await pb.collection('persons').getFullList<Person>();
      setPersons(records);
    } catch (error) {
      console.error('Error loading persons:', error);
    }
  }

  function openAddModal() {
    setFormData({
      credit_card: creditCards.length > 0 ? creditCards[0].id : '',
      person: persons.length > 0 ? persons[0].id : '',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      description: '',
      purchase: ''  // No purchase relation for standalone transactions
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      // Create the transaction
      const transactionData = {
        ...formData,
        amount: parseFloat(formData.amount),
        // Only include purchase field if it has a value
        ...(formData.purchase ? { purchase: formData.purchase } : {})
      };
      
      await pb.collection('transactions').create(transactionData);
      closeModal();
      loadTransactions();
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  }

  // Format date to a more readable format
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  // Determine if a transaction is a payment (negative amount)
  function isPayment(amount: number) {
    return amount < 0;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Transactions</h1>
      <button 
        onClick={openAddModal}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Add Transaction
      </button>
      
      <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Card</th>
              <th className="p-3 text-left">Person</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Purchase</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-3 text-center text-gray-500">No transactions found</td>
              </tr>
            ) : (
              transactions.map(transaction => (
                <tr key={transaction.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{formatDate(transaction.date)}</td>
                  <td className="p-3">{transaction.description}</td>
                  <td className={`p-3 ${isPayment(transaction.amount) ? 'text-green-600' : 'text-red-600'}`}>
                    ${Math.abs(transaction.amount).toFixed(2)}
                    {isPayment(transaction.amount) ? ' (payment)' : ''}
                  </td>
                  <td className="p-3">
                    {transaction.expand?.credit_card ? (
                      <span>
                        {transaction.expand.credit_card.credit_card_name || transaction.expand.credit_card.last_four_digits}
                        {transaction.expand.credit_card.is_supplementary && transaction.expand.credit_card.expand?.principal_card && (
                          <span className="text-xs text-gray-500 block">
                            (Supplementary of {transaction.expand.credit_card.expand.principal_card.credit_card_name})
                          </span>
                        )}
                      </span>
                    ) : (
                      'Unknown Card'
                    )}
                  </td>
                  <td className="p-3">{transaction.expand?.person?.name}</td>
                  <td className="p-3">{transaction.purchase ? 'Purchase' : 'Standalone'}</td>
                  <td className="p-3">
                    {transaction.expand?.purchase ? (
                      <Link 
                        href={`/purchases/${transaction.expand.purchase.id}`} 
                        className="text-blue-500 hover:underline"
                      >
                        View
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Add Transaction</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Credit Card</label>
                <select
                  name="credit_card"
                  value={formData.credit_card}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                >
                  {creditCards.map(card => (
                    <option key={card.id} value={card.id}>
                      {card.credit_card_name || card.issuer} **** {card.last_four_digits}
                      {card.is_supplementary ? ' (Supplementary)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Person</label>
                <select
                  name="person"
                  value={formData.person}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                >
                  {persons.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Amount (negative for payments)</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  step="0.01"
                  required
                  placeholder="Use negative value for payments"
                />
                <small className="text-gray-500">
                  Enter a positive amount for purchases or a negative amount for payments (e.g., -50.00)
                </small>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                  placeholder="E.g., 'Monthly payment' or 'Refund'"
                ></textarea>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
