'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { pb, Purchase, CreditCard, Person } from '../lib/pocketbase';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [formData, setFormData] = useState({
    credit_card: '',
    person: '',
    purchase_date: '',
    total_amount: '',
    description: '',
    num_installments: '1',
    is_bnpl: false
  });

  useEffect(() => {
    loadPurchases();
    loadCreditCards();
    loadPersons();
  }, []);

  async function loadPurchases() {
    try {
      const records = await pb.collection('purchases').getFullList<Purchase>({
        expand: 'credit_card,person',
        sort: '-purchase_date'
      });
      setPurchases(records);
    } catch (error) {
      console.error('Error loading purchases:', error);
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
      purchase_date: new Date().toISOString().split('T')[0],
      total_amount: '',
      description: '',
      num_installments: '1',
      is_bnpl: false
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData(prev => ({
        ...prev,
        [name]: checkbox.checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      // Create the purchase
      const purchaseData = {
        ...formData,
        total_amount: parseFloat(formData.total_amount),
        num_installments: parseInt(formData.num_installments),
      };
      
      const purchase = await pb.collection('purchases').create(purchaseData);
      
      // Create the transactions for installments
      const installmentAmount = purchaseData.total_amount / purchaseData.num_installments;
      
      for (let i = 0; i < purchaseData.num_installments; i++) {
        // Calculate the transaction date
        const transactionDate = new Date(formData.purchase_date);
        transactionDate.setMonth(transactionDate.getMonth() + i);
        
        // Create a transaction for this installment
        await pb.collection('transactions').create({
          credit_card: formData.credit_card,
          person: formData.person,
          date: transactionDate.toISOString().split('T')[0],
          amount: installmentAmount,
          description: purchaseData.num_installments > 1 
            ? `${formData.description} (Installment ${i + 1}/${purchaseData.num_installments})` 
            : formData.description,
          purchase: purchase.id
        });
      }
      
      closeModal();
      loadPurchases();
    } catch (error) {
      console.error('Error saving purchase:', error);
    }
  }

  // Format date to a more readable format
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Purchases</h1>
      <button 
        onClick={openAddModal}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Add Purchase
      </button>
      
      <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Total Amount</th>
              <th className="p-3 text-left">Card</th>
              <th className="p-3 text-left">Person</th>
              <th className="p-3 text-left">Installments</th>
              <th className="p-3 text-left">BNPL</th>
              <th className="p-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-3 text-center text-gray-500">No purchases found</td>
              </tr>
            ) : (
              purchases.map(purchase => (
                <tr key={purchase.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{formatDate(purchase.purchase_date)}</td>
                  <td className="p-3">{purchase.description}</td>
                  <td className="p-3">${purchase.total_amount.toFixed(2)}</td>
                  <td className="p-3">
                    {purchase.expand?.credit_card ? (
                      <span>
                        {purchase.expand.credit_card.credit_card_name || purchase.expand.credit_card.last_four_digits}
                        {purchase.expand.credit_card.is_supplementary && purchase.expand.credit_card.expand?.principal_card && (
                          <span className="text-xs text-gray-500 block">
                            (Supplementary of {purchase.expand.credit_card.expand.principal_card.credit_card_name})
                          </span>
                        )}
                      </span>
                    ) : (
                      'Unknown Card'
                    )}
                  </td>
                  <td className="p-3">{purchase.expand?.person?.name}</td>
                  <td className="p-3">{purchase.num_installments}</td>
                  <td className="p-3">{purchase.is_bnpl ? 'Yes' : 'No'}</td>
                  <td className="p-3">
                    <Link href={`/purchases/${purchase.id}`} className="text-blue-500 hover:underline">
                      View
                    </Link>
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
            <h2 className="text-xl font-semibold mb-4">Add Purchase</h2>
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
                  name="purchase_date"
                  value={formData.purchase_date}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Total Amount</label>
                <input
                  type="number"
                  name="total_amount"
                  value={formData.total_amount}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                ></textarea>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Number of Installments</label>
                <input
                  type="number"
                  name="num_installments"
                  value={formData.num_installments}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  min="1"
                  required
                />
              </div>
              <div className="mb-4 flex items-center">
                <input
                  type="checkbox"
                  name="is_bnpl"
                  checked={formData.is_bnpl}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <label className="text-gray-700">Buy Now Pay Later (BNPL)</label>
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
