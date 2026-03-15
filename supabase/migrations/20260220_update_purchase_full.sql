-- Migration: Comprehensive atomic update for purchase with full recalculation
-- Date: 2026-02-20
-- Purpose: Handle all purchase edit scenarios atomically including amount/date recalculation

CREATE OR REPLACE FUNCTION update_purchase_full(
    p_id UUID,
    p_description TEXT DEFAULT NULL,
    p_purchase_date DATE DEFAULT NULL,
    p_is_bnpl BOOLEAN DEFAULT NULL,
    p_credit_card_id UUID DEFAULT NULL,
    p_person_id UUID DEFAULT NULL,
    p_total_amount NUMERIC DEFAULT NULL,
    p_billing_start_date DATE DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_purchase RECORD;
    v_new_amount NUMERIC;
    v_new_start_date DATE;
    v_result JSON;
BEGIN
    -- Get current purchase data for defaults and num_installments
    SELECT * INTO v_purchase FROM purchases WHERE id = p_id;

    -- Determine effective values
    v_new_amount := COALESCE(p_total_amount, v_purchase.total_amount);
    v_new_start_date := COALESCE(p_billing_start_date, v_purchase.billing_start_date);

    -- Update the purchase record with all provided fields
    UPDATE purchases
    SET
        description = COALESCE(p_description, description),
        purchase_date = COALESCE(p_purchase_date, purchase_date),
        is_bnpl = COALESCE(p_is_bnpl, is_bnpl),
        credit_card_id = COALESCE(p_credit_card_id, credit_card_id),
        person_id = COALESCE(p_person_id, person_id),
        total_amount = v_new_amount,
        billing_start_date = v_new_start_date
    WHERE id = p_id;

    -- Cascade credit_card_id and/or person_id to transactions if changed
    IF p_credit_card_id IS NOT NULL OR p_person_id IS NOT NULL THEN
        UPDATE transactions
        SET
            credit_card_id = COALESCE(p_credit_card_id, credit_card_id),
            person_id = COALESCE(p_person_id, person_id)
        WHERE purchase_id = p_id;
    END IF;

    -- Recalculate transaction amounts if total_amount changed
    IF p_total_amount IS NOT NULL THEN
        UPDATE transactions
        SET amount = v_new_amount / v_purchase.num_installments
        WHERE purchase_id = p_id;
    END IF;

    -- Recalculate transaction dates if billing_start_date changed
    -- Use ROW_NUMBER ordered by existing date to preserve installment order
    IF p_billing_start_date IS NOT NULL THEN
        UPDATE transactions t
        SET date = (v_new_start_date + (rn.row_num * INTERVAL '1 month'))::DATE
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY date ASC) - 1 AS row_num
            FROM transactions
            WHERE purchase_id = p_id
        ) rn
        WHERE t.id = rn.id;
    END IF;

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
