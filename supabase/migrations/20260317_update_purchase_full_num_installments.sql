-- Migration: Extend full purchase update to support num_installments edits
-- Date: 2026-03-17
-- Purpose: Handle structural transaction add/remove when installment count changes

CREATE OR REPLACE FUNCTION update_purchase_full(
    p_id UUID,
    p_description TEXT DEFAULT NULL,
    p_purchase_date DATE DEFAULT NULL,
    p_is_bnpl BOOLEAN DEFAULT NULL,
    p_credit_card_id UUID DEFAULT NULL,
    p_person_id UUID DEFAULT NULL,
    p_total_amount NUMERIC DEFAULT NULL,
    p_billing_start_date DATE DEFAULT NULL,
    p_num_installments INTEGER DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_purchase RECORD;
    v_new_amount NUMERIC;
    v_new_start_date DATE;
    v_new_description TEXT;
    v_new_credit_card_id UUID;
    v_new_person_id UUID;
    v_new_installments INTEGER;
    v_existing_installments INTEGER;
    v_result JSON;
    i INTEGER;
BEGIN
    -- Get current purchase data for defaults
    SELECT * INTO v_purchase FROM purchases WHERE id = p_id;

    -- Determine effective values
    v_new_amount := COALESCE(p_total_amount, v_purchase.total_amount);
    v_new_start_date := COALESCE(p_billing_start_date, v_purchase.billing_start_date);
    v_new_description := COALESCE(p_description, v_purchase.description);
    v_new_credit_card_id := COALESCE(p_credit_card_id, v_purchase.credit_card_id);
    v_new_person_id := COALESCE(p_person_id, v_purchase.person_id);
    v_new_installments := COALESCE(p_num_installments, v_purchase.num_installments);

    IF v_new_installments < 1 THEN
        RAISE EXCEPTION 'num_installments must be at least 1';
    END IF;

    -- Update the purchase record with all provided fields
    UPDATE purchases
    SET
        description = v_new_description,
        purchase_date = COALESCE(p_purchase_date, purchase_date),
        is_bnpl = COALESCE(p_is_bnpl, is_bnpl),
        credit_card_id = v_new_credit_card_id,
        person_id = v_new_person_id,
        total_amount = v_new_amount,
        billing_start_date = v_new_start_date,
        num_installments = v_new_installments
    WHERE id = p_id;

    -- Keep transaction count in sync with installments.
    SELECT COUNT(*) INTO v_existing_installments
    FROM transactions
    WHERE purchase_id = p_id;

    IF v_existing_installments > v_new_installments THEN
        DELETE FROM transactions
        WHERE id IN (
            SELECT id
            FROM transactions
            WHERE purchase_id = p_id
            ORDER BY date ASC, created_at ASC, id ASC
            OFFSET v_new_installments
        );
    ELSIF v_existing_installments < v_new_installments THEN
        FOR i IN v_existing_installments..(v_new_installments - 1) LOOP
            INSERT INTO transactions (
                credit_card_id,
                person_id,
                purchase_id,
                date,
                amount,
                description
            ) VALUES (
                v_new_credit_card_id,
                v_new_person_id,
                p_id,
                (v_new_start_date + (i * INTERVAL '1 month'))::DATE,
                v_new_amount / v_new_installments,
                CASE
                    WHEN v_new_installments > 1
                        THEN format('%s (Installment %s/%s)', v_new_description, i + 1, v_new_installments)
                    ELSE v_new_description
                END
            );
        END LOOP;
    END IF;

    -- Normalize all installment transactions (amount/date/description/card/person).
    UPDATE transactions t
    SET
        credit_card_id = v_new_credit_card_id,
        person_id = v_new_person_id,
        amount = v_new_amount / v_new_installments,
        date = (v_new_start_date + (rn.row_num * INTERVAL '1 month'))::DATE,
        description = CASE
            WHEN v_new_installments > 1
                THEN format('%s (Installment %s/%s)', v_new_description, rn.row_num + 1, v_new_installments)
            ELSE v_new_description
        END
    FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY date ASC, created_at ASC, id ASC) - 1 AS row_num
        FROM transactions
        WHERE purchase_id = p_id
    ) rn
    WHERE t.id = rn.id;

    -- Return updated purchase with related data and refreshed transactions
    SELECT json_build_object(
        'purchase', row_to_json(p.*),
        'credit_cards', (
            SELECT json_agg(cc.*)
            FROM credit_cards cc
            WHERE cc.id = p.credit_card_id
        ),
        'persons', (
            SELECT json_agg(pr.*)
            FROM persons pr
            WHERE pr.id = p.person_id
        ),
        'transactions', (
            SELECT json_agg(tr.* ORDER BY tr.date ASC)
            FROM transactions tr
            WHERE tr.purchase_id = p_id
        )
    ) INTO v_result
    FROM purchases p
    WHERE p.id = p_id;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update purchase: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
