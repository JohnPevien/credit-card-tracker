-- Migration: Atomic cascade update for purchase with transactions
-- Date: 2026-02-19
-- Purpose: Ensure purchase and related transaction updates happen atomically

-- Create function to update purchase with cascade to transactions
-- This function updates the purchase record and optionally cascades
-- credit_card_id and person_id changes to all related transactions
CREATE OR REPLACE FUNCTION update_purchase_with_cascade(
    p_id UUID,
    p_description TEXT DEFAULT NULL,
    p_purchase_date DATE DEFAULT NULL,
    p_is_bnpl BOOLEAN DEFAULT NULL,
    p_credit_card_id UUID DEFAULT NULL,
    p_person_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Check if purchase exists first
    PERFORM 1 FROM purchases WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase not found: %', p_id;
    END IF;

    -- Update the purchase record
    UPDATE purchases
    SET
        description = COALESCE(p_description, description),
        purchase_date = COALESCE(p_purchase_date, purchase_date),
        is_bnpl = COALESCE(p_is_bnpl, is_bnpl),
        credit_card_id = COALESCE(p_credit_card_id, credit_card_id),
        person_id = COALESCE(p_person_id, person_id)
    WHERE id = p_id;

    -- Cascade update to transactions if credit_card_id or person_id changed
    IF p_credit_card_id IS NOT NULL OR p_person_id IS NOT NULL THEN
        UPDATE transactions
        SET
            credit_card_id = COALESCE(p_credit_card_id, credit_card_id),
            person_id = COALESCE(p_person_id, person_id)
        WHERE purchase_id = p_id;
    END IF;

    -- Build and return the result with related data
    SELECT json_build_object(
        'purchase', row_to_json(purchase_row.*),
        'credit_cards', (
            SELECT json_agg(cc.*)
            FROM credit_cards cc
            WHERE cc.id = purchase_row.credit_card_id
        ),
        'persons', (
            SELECT json_agg(pr.*)
            FROM persons pr
            WHERE pr.id = purchase_row.person_id
        )
    ) INTO v_result
    FROM (
        SELECT p.*
        FROM purchases p
        WHERE p.id = p_id
    ) AS purchase_row;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update purchase with cascade: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users (adjust as needed)
-- GRANT EXECUTE ON FUNCTION update_purchase_with_cascade TO authenticated;
