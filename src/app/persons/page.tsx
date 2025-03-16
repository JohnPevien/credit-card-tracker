'use client';
import { useState, useEffect } from 'react';
import { pb, Person } from '../lib/pocketbase';

export default function PersonsPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    loadPersons();
  }, []);

  async function loadPersons() {
    try {
      const records = await pb.collection('persons').getFullList<Person>();
      setPersons(records);
    } catch (error) {
      console.error('Error loading persons:', error);
    }
  }

  function openAddModal() {
    setName('');
    setEditingPerson(null);
    setIsModalOpen(true);
  }

  function openEditModal(person: Person) {
    setName(person.name);
    setEditingPerson(person);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingPerson) {
        await pb.collection('persons').update(editingPerson.id, { name });
      } else {
        await pb.collection('persons').create({ name });
      }
      closeModal();
      loadPersons();
    } catch (error) {
      console.error('Error saving person:', error);
    }
  }

  async function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this person?')) {
      try {
        await pb.collection('persons').delete(id);
        loadPersons();
      } catch (error) {
        console.error('Error deleting person:', error);
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Persons</h1>
      <button 
        onClick={openAddModal}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Add Person
      </button>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {persons.length === 0 ? (
              <tr>
                <td colSpan={2} className="p-3 text-center text-gray-500">No persons found</td>
              </tr>
            ) : (
              persons.map(person => (
                <tr key={person.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{person.name}</td>
                  <td className="p-3">
                    <button 
                      onClick={() => openEditModal(person)} 
                      className="text-blue-500 hover:text-blue-700 mr-2"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(person.id)} 
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">
              {editingPerson ? 'Edit Person' : 'Add Person'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
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
