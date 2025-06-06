import React from 'react';
import { Select, DateInput, Input, Textarea, Checkbox } from '@/components/base';
import { CreditCard, Person } from '@/lib/supabase';

interface PurchaseFormData {
  credit_card_id: string;
  person_id: string;
  purchase_date: string;
  billing_start_date: string;
  total_amount: string;
  description: string;
  num_installments: string;
  is_bnpl: boolean;
}

interface PurchaseFormProps {
  formData: PurchaseFormData;
  creditCards: CreditCard[];
  persons: Person[];
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSelectChange: (name: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function PurchaseForm({
  formData,
  creditCards,
  persons,
  onInputChange,
  onSelectChange,
  onSubmit,
  onCancel
}: PurchaseFormProps) {
  const formatCreditCardLabel = (card: CreditCard): string => {
    return `${card.credit_card_name || card.issuer} **** ${card.last_four_digits}${
      card.is_supplementary ? " (Supplementary)" : ""
    }`;
  };

  const creditCardOptions = creditCards.map((card) => ({
    value: card.id,
    label: formatCreditCardLabel(card),
  }));

  const personOptions = persons.map((person) => ({
    value: person.id,
    label: person.name,
  }));

  return (
    <form onSubmit={onSubmit}>
      <div className="form-control mb-4">
        <div className="label">
          <span className="label-text">Credit Card</span>
        </div>
        <Select
          name="credit_card_id"
          value={formData.credit_card_id}
          onChange={(value) => onSelectChange("credit_card_id", value)}
          options={creditCardOptions}
          required
        />
      </div>

      <div className="form-control mb-4">
        <div className="label">
          <span className="label-text">Person</span>
        </div>
        <Select
          name="person_id"
          value={formData.person_id}
          onChange={(value) => onSelectChange("person_id", value)}
          options={personOptions}
          required
        />
      </div>

      <div className="form-control mb-4">
        <div className="label">
          <span className="label-text">Date</span>
        </div>
        <DateInput
          name="purchase_date"
          value={formData.purchase_date}
          onChange={onInputChange}
          required
        />
      </div>      <div className="form-control mb-4">
        <Input
          label="Total Amount"
          type="number"
          name="total_amount"
          value={formData.total_amount}
          onChange={onInputChange}
          step="0.01"
          min="0"
          required
        />
      </div>      <div className="form-control mb-4">
        <Textarea
          label="Description"
          name="description"
          value={formData.description}
          onChange={onInputChange}
          required
        />
      </div>      <div className="form-control mb-4">
        <Input
          label="Number of Installments"
          type="number"
          name="num_installments"
          value={formData.num_installments}
          onChange={onInputChange}
          min="1"
          required
        />
      </div>      <div className="form-control mb-4">
        <Checkbox
          label="Buy Now Pay Later (BNPL)"
          name="is_bnpl"
          checked={formData.is_bnpl}
          onChange={onInputChange}
          labelPosition="right"
        />
      </div>

      <div className="form-control mb-4">
        <div className="label">
          <span className="label-text">Billing Start Date</span>
        </div>
        <DateInput
          name="billing_start_date"
          value={formData.billing_start_date}
          onChange={onInputChange}
          required
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </div>
    </form>
  );
}
