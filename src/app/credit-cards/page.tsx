'use client';
import { useState, useEffect } from 'react';
import { pb, CreditCard } from '../lib/pocketbase';

export default function CreditCardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [principalCards, setPrincipalCards] = useState<CreditCard[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [formData, setFormData] = useState({
    credit_card_name: '',
    last_four_digits: '',
    cardholder_name: '',
    issuer: '',
    is_supplementary: false,
    principal_card_id: ''
  });

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    try {
      const records = await pb.collection('credit_cards').getFullList<CreditCard>({
        expand: 'principal_card'
      });
      setCards(records);
      
      // Filter principal cards for the dropdown
      const principalOnly = records.filter(card => !card.is_supplementary);
      setPrincipalCards(principalOnly);
    } catch (error) {
      console.error('Error loading credit cards:', error);
    }
  }

  function openAddModal() {
    setFormData({
      credit_card_name: '',
      last_four_digits: '',
      cardholder_name: '',
      issuer: '',
      is_supplementary: false,
      principal_card_id: ''
    });
    setEditingCard(null);
    setIsAddModalOpen(true);
  }

  function openEditModal(card: CreditCard) {
    setFormData({
      credit_card_name: card.credit_card_name || '',
      last_four_digits: card.last_four_digits,
      cardholder_name: card.cardholder_name,
      issuer: card.issuer,
      is_supplementary: card.is_supplementary || false,
      principal_card_id: card.principal_card_id || ''
    });
    setEditingCard(card);
    setIsAddModalOpen(true);
  }

  function closeModal() {
    setIsAddModalOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target as HTMLInputElement;
    
    // Handle checkbox type for is_supplementary
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked,
        // Reset principal_card_id if switching to non-supplementary
        ...(name === 'is_supplementary' && !checked ? { principal_card_id: '' } : {})
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
    
    // If not supplementary, ensure principal_card_id is null
    const submitData = {
      ...formData,
      principal_card_id: formData.is_supplementary ? formData.principal_card_id : null
    };
    
    try {
      if (editingCard) {
        await pb.collection('credit_cards').update(editingCard.id, submitData);
      } else {
        await pb.collection('credit_cards').create(submitData);
      }
      closeModal();
      loadCards();
    } catch (error) {
      console.error('Error saving credit card:', error);
    }
  }

  async function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this credit card?')) {
      try {
        await pb.collection('credit_cards').delete(id);
        loadCards();
      } catch (error) {
        console.error('Error deleting credit card:', error);
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Credit Cards</h1>
      <button 
        onClick={openAddModal}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Add Credit Card
      </button>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3 text-left">Card Name</th>
              <th className="p-3 text-left">Last 4 Digits</th>
              <th className="p-3 text-left">Cardholder</th>
              <th className="p-3 text-left">Issuer</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Principal Card</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-3 text-center text-gray-500">No credit cards found</td>
              </tr>
            ) : (
              cards.map(card => (
                <tr key={card.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{card.credit_card_name}</td>
                  <td className="p-3">{card.last_four_digits}</td>
                  <td className="p-3">{card.cardholder_name}</td>
                  <td className="p-3">{card.issuer}</td>
                  <td className="p-3">{card.is_supplementary ? 'Supplementary' : 'Principal'}</td>
                  <td className="p-3">
                    {card.is_supplementary && card.expand?.principal_card 
                      ? card.expand.principal_card.credit_card_name 
                      : '-'}
                  </td>
                  <td className="p-3">
                    <button 
                      onClick={() => openEditModal(card)} 
                      className="text-blue-500 hover:text-blue-700 mr-2"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(card.id)} 
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">
              {editingCard ? 'Edit Credit Card' : 'Add Credit Card'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Card Name</label>
                <input
                  type="text"
                  name="credit_card_name"
                  value={formData.credit_card_name}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  placeholder="My Main Card"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Last 4 Digits</label>
                <input
                  type="text"
                  name="last_four_digits"
                  value={formData.last_four_digits}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  maxLength={4}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Cardholder Name</label>
                <input
                  type="text"
                  name="cardholder_name"
                  value={formData.cardholder_name}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Issuer</label>
                <input
                  type="text"
                  name="issuer"
                  value={formData.issuer}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_supplementary"
                    checked={formData.is_supplementary}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  <span className="text-gray-700">This is a supplementary card</span>
                </label>
              </div>
              
              {formData.is_supplementary && (
                <div className="mb-4">
                  <label className="block text-gray-700 mb-1">Principal Card</label>
                  <select
                    name="principal_card_id"
                    value={formData.principal_card_id}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                    required={formData.is_supplementary}
                  >
                    <option value="">Select a principal card</option>
                    {principalCards.map(card => (
                      <option key={card.id} value={card.id}>
                        {card.credit_card_name || card.last_four_digits}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
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
