import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

// Type definitions for our collections
export interface Person {
    id: string;
    name: string;
    slug: string;
    created_at?: string;
}

export interface CreditCard {
    id: string;
    credit_card_name: string;
    last_four_digits: string;
    cardholder_name: string;
    issuer: string;
    is_supplementary: boolean;
    principal_card_id?: string;
    created_at?: string;
    principal_card?: CreditCard;
    // Add expand property for related data from queries
    expand?: {
        principal_card?: CreditCard;
    };
}

export type CreditCardInsert = {
    credit_card_name: string;
    last_four_digits: string;
    cardholder_name: string;
    issuer: string;
    is_supplementary: boolean;
    principal_card_id?: string | null;
};

export interface Purchase {
    id: string;
    credit_card_id: string;
    person_id: string;
    purchase_date: string;
    billing_start_date?: string;
    total_amount: number;
    description: string;
    num_installments: number;
    is_bnpl: boolean;
    created_at?: string;
    credit_cards?: CreditCard;
    persons?: Person;
    // Add expand property for related data from queries
    expand?: {
        credit_card?: CreditCard;
        person?: Person;
    };
}

export interface Transaction {
    id: string;
    credit_card_id: string;
    person_id: string;
    purchase_id?: string;
    date: string;
    amount: number;
    description: string;
    paid: boolean;
    created_at?: string;
    credit_cards?: CreditCard;
    persons?: Person;
    purchases?: Purchase;
    // Add expand property for related data from queries
    expand?: {
        credit_card?: CreditCard;
        person?: Person;
        purchase?: Purchase;
    };
}
