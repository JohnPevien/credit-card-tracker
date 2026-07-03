-- Migration: Create bulk purchase transactional RPC function
-- Date: 2026-06-07
-- Purpose: Bulk insert purchases and their associated installment transactions atomically inside a single database transaction

CREATE OR REPLACE FUNCTION bulk_create_purchases_with_transactions(
    p_purchases JSONB
) RETURNS UUID[] AS $$
DECLARE
    v_purchase_item JSONB;
    v_purchase_id UUID;
    v_installment_amount NUMERIC;
    v_billing_start_date DATE;
    v_num_installments INTEGER;
    v_description TEXT;
    v_credit_card_id UUID;
    v_person_id UUID;
    v_purchase_date DATE;
    v_is_bnpl BOOLEAN;
    v_created_ids UUID[] := ARRAY[]::UUID[];
    i INTEGER;
BEGIN
    FOR v_purchase_item IN SELECT * FROM jsonb_array_elements(p_purchases) LOOP
        -- Extract values
        v_credit_card_id := (v_purchase_item->>'credit_card_id')::UUID;
        v_person_id := (v_purchase_item->>'person_id')::UUID;
        v_purchase_date := (v_purchase_item->>'purchase_date')::DATE;
        v_billing_start_date := (v_purchase_item->>'billing_start_date')::DATE;
        v_description := v_purchase_item->>'description';
        v_is_bnpl := COALESCE((v_purchase_item->>'is_bnpl')::BOOLEAN, false);
        v_num_installments := COALESCE((v_purchase_item->>'num_installments')::INTEGER, 1);
        IF v_num_installments < 1 THEN
            RAISE EXCEPTION 'num_installments must be >= 1, got %', v_num_installments
                USING ERRCODE = '22023';
        END IF;
        v_installment_amount := (v_purchase_item->>'total_amount')::NUMERIC / v_num_installments;

        -- Insert purchase
        INSERT INTO purchases (
            credit_card_id,
            person_id,
            purchase_date,
            billing_start_date,
            total_amount,
            description,
            num_installments,
            is_bnpl
        ) VALUES (
            v_credit_card_id,
            v_person_id,
            v_purchase_date,
            v_billing_start_date,
            (v_purchase_item->>'total_amount')::NUMERIC,
            v_description,
            v_num_installments,
            v_is_bnpl
        ) RETURNING id INTO v_purchase_id;

        v_created_ids := v_created_ids || v_purchase_id;

        -- Insert transactions
        FOR i IN 0..(v_num_installments - 1) LOOP
            INSERT INTO transactions (
                credit_card_id,
                person_id,
                purchase_id,
                date,
                amount,
                description
            ) VALUES (
                v_credit_card_id,
                v_person_id,
                v_purchase_id,
                (v_billing_start_date + (i * INTERVAL '1 month'))::DATE,
                v_installment_amount,
                CASE
                    WHEN v_num_installments > 1
                        THEN format('%s (Installment %s/%s)', v_description, i + 1, v_num_installments)
                    ELSE v_description
                END
            );
        END LOOP;
    END LOOP;
    RETURN v_created_ids;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;
