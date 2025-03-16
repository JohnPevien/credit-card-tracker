import PocketBase from 'pocketbase';

// Initialize PocketBase client
export const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090');

// Type definitions for our collections
export interface Person {
  id: string;
  name: string;
}

export interface CreditCard {
  id: string;
  credit_card_name: string;
  last_four_digits: string;
  cardholder_name: string;
  issuer: string;
  is_supplementary: boolean;
  principal_card_id?: string;
  expand?: {
    principal_card?: CreditCard;
  };
}

export interface Purchase {
  id: string;
  credit_card: string;
  person: string;
  purchase_date: string;
  total_amount: number;
  description: string;
  num_installments: number;
  is_bnpl: boolean;
  expand?: {
    credit_card?: CreditCard;
    person?: Person;
  };
}

export interface Transaction {
  id: string;
  credit_card: string;
  person: string;
  date: string;
  amount: number;
  description: string;
  purchase?: string;
  expand?: {
    credit_card?: CreditCard;
    person?: Person;
    purchase?: Purchase;
  };
}
