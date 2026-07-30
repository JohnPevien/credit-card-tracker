-- Close payer-confirmation and payer-portal throttling races.
-- PIN attempts are ephemeral, so the prior attempt window is cleared while
-- upgrading it to candidate-specific HMAC scope buckets.

BEGIN;

REVOKE ALL ON FUNCTION public.ack_reserve_payer_portal_attempt(uuid, text, uuid)
    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ack_complete_payer_portal_unlock(uuid, uuid, integer)
    FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.ack_reserve_payer_portal_attempt(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.ack_complete_payer_portal_unlock(uuid, uuid, integer);

DELETE FROM public.payer_portal_pin_attempts;

ALTER TABLE public.payer_portal_pin_attempts
    ADD COLUMN IF NOT EXISTS portal_scope_hash text;
ALTER TABLE public.payer_portal_pin_attempts
    ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
ALTER TABLE public.payer_portal_pin_attempts
    ALTER COLUMN portal_scope_hash SET NOT NULL;
ALTER TABLE public.payer_portal_pin_attempts
    ADD CONSTRAINT payer_portal_pin_attempts_scope_hash_check
        CHECK (portal_scope_hash ~ '^[0-9a-f]{64}$');

DROP INDEX IF EXISTS public.payer_portal_pin_attempts_rate_limit_idx;
CREATE INDEX payer_portal_pin_attempts_scope_limit_idx
    ON public.payer_portal_pin_attempts (
        portal_scope_hash,
        network_hash,
        attempted_at DESC
    );

CREATE OR REPLACE FUNCTION public.ack_reserve_payer_portal_attempt(
    p_public_id uuid,
    p_portal_scope_hash text,
    p_network_hash text,
    p_reservation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_portal public.payer_portal_access%ROWTYPE;
    v_failure_count integer;
    v_oldest_failure timestamptz;
    v_retry_after integer;
    v_portal_payload jsonb;
BEGIN
    IF p_portal_scope_hash IS NULL
       OR p_portal_scope_hash !~ '^[0-9a-f]{64}$'
       OR p_network_hash IS NULL
       OR p_network_hash !~ '^[0-9a-f]{64}$'
       OR p_reservation_id IS NULL THEN
        RAISE EXCEPTION 'invalid portal verification reservation'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_portal
    FROM public.payer_portal_access
    WHERE public_id = p_public_id;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            p_portal_scope_hash || ':' || p_network_hash,
            0
        )
    );

    DELETE FROM public.payer_portal_pin_attempts
    WHERE portal_scope_hash = p_portal_scope_hash
      AND network_hash = p_network_hash
      AND attempted_at <= clock_timestamp() - interval '15 minutes';

    SELECT count(*), min(attempted_at)
    INTO v_failure_count, v_oldest_failure
    FROM public.payer_portal_pin_attempts
    WHERE portal_scope_hash = p_portal_scope_hash
      AND network_hash = p_network_hash
      AND attempted_at > clock_timestamp() - interval '15 minutes';

    IF v_failure_count >= 5 THEN
        v_retry_after := greatest(
            1,
            least(
                900,
                ceil(
                    extract(
                        epoch FROM (
                            v_oldest_failure
                            + interval '15 minutes'
                            - clock_timestamp()
                        )
                    )
                )::integer
            )
        );

        RETURN jsonb_build_object(
            'allowed', false,
            'retry_after_seconds', v_retry_after,
            'portal', NULL
        );
    END IF;

    INSERT INTO public.payer_portal_pin_attempts (
        portal_person_id,
        portal_scope_hash,
        network_hash,
        succeeded,
        reservation_id,
        attempted_at,
        finalized_at
    )
    VALUES (
        v_portal.person_id,
        p_portal_scope_hash,
        p_network_hash,
        false,
        p_reservation_id,
        clock_timestamp(),
        NULL
    );

    IF v_portal.person_id IS NULL THEN
        v_portal_payload := NULL;
    ELSE
        v_portal_payload := jsonb_build_object(
            'person_id', v_portal.person_id,
            'public_id', v_portal.public_id,
            'pin_hash', v_portal.pin_hash,
            'credential_version', v_portal.credential_version,
            'revoked_at', v_portal.revoked_at
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'reservation_id', p_reservation_id,
        'portal', v_portal_payload
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_finalize_payer_portal_attempt(
    p_reservation_id uuid,
    p_portal_scope_hash text,
    p_network_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_scope_hash text;
    v_network_hash text;
    v_attempt public.payer_portal_pin_attempts%ROWTYPE;
BEGIN
    SELECT portal_scope_hash, network_hash
    INTO v_scope_hash, v_network_hash
    FROM public.payer_portal_pin_attempts
    WHERE reservation_id = p_reservation_id;

    IF NOT FOUND
       OR v_scope_hash IS DISTINCT FROM p_portal_scope_hash
       OR v_network_hash IS DISTINCT FROM p_network_hash THEN
        RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_scope_hash || ':' || v_network_hash, 0)
    );

    SELECT *
    INTO v_attempt
    FROM public.payer_portal_pin_attempts
    WHERE reservation_id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_attempt.portal_scope_hash IS DISTINCT FROM v_scope_hash
       OR v_attempt.network_hash IS DISTINCT FROM v_network_hash THEN
        RETURN;
    END IF;

    IF v_attempt.finalized_at IS NULL THEN
        UPDATE public.payer_portal_pin_attempts
        SET finalized_at = clock_timestamp()
        WHERE id = v_attempt.id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_complete_payer_portal_unlock(
    p_reservation_id uuid,
    p_public_id uuid,
    p_credential_version integer,
    p_portal_scope_hash text,
    p_network_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_scope_hash text;
    v_network_hash text;
    v_attempt public.payer_portal_pin_attempts%ROWTYPE;
    v_portal public.payer_portal_access%ROWTYPE;
BEGIN
    SELECT portal_scope_hash, network_hash
    INTO v_scope_hash, v_network_hash
    FROM public.payer_portal_pin_attempts
    WHERE reservation_id = p_reservation_id;

    IF NOT FOUND
       OR v_scope_hash IS DISTINCT FROM p_portal_scope_hash
       OR v_network_hash IS DISTINCT FROM p_network_hash THEN
        RETURN NULL;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_scope_hash || ':' || v_network_hash, 0)
    );

    SELECT *
    INTO v_attempt
    FROM public.payer_portal_pin_attempts
    WHERE reservation_id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_attempt.portal_scope_hash IS DISTINCT FROM v_scope_hash
       OR v_attempt.network_hash IS DISTINCT FROM v_network_hash
       OR v_attempt.finalized_at IS NOT NULL
       OR v_attempt.portal_person_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT *
    INTO v_portal
    FROM public.payer_portal_access
    WHERE public_id = p_public_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_portal.person_id IS DISTINCT FROM v_attempt.portal_person_id
       OR v_portal.credential_version <> p_credential_version
       OR v_portal.revoked_at IS NOT NULL THEN
        RETURN NULL;
    END IF;

    DELETE FROM public.payer_portal_pin_attempts
    WHERE portal_scope_hash = p_portal_scope_hash
      AND network_hash = p_network_hash
      AND (
          finalized_at IS NOT NULL
          OR reservation_id = p_reservation_id
      );

    UPDATE public.payer_portal_access
    SET last_accessed_at = clock_timestamp()
    WHERE person_id = v_portal.person_id
    RETURNING * INTO v_portal;

    RETURN jsonb_build_object(
        'person_id', v_portal.person_id,
        'public_id', v_portal.public_id,
        'credential_version', v_portal.credential_version
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_confirm_payer_receipt(
    p_receipt_id uuid,
    p_expected_revision integer,
    p_authorized_person_id uuid
)
RETURNS public.acknowledgement_receipts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_receipt public.acknowledgement_receipts%ROWTYPE;
BEGIN
    SELECT *
    INTO v_receipt
    FROM public.acknowledgement_receipts
    WHERE id = p_receipt_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_receipt.payer_person_id IS DISTINCT FROM p_authorized_person_id THEN
        RAISE no_data_found;
    END IF;

    IF v_receipt.published_at IS NULL
       OR v_receipt.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'receipt is unavailable'
            USING ERRCODE = '55000';
    END IF;

    IF v_receipt.revision_number <> p_expected_revision THEN
        RAISE EXCEPTION 'acknowledgement receipt revision conflict'
            USING ERRCODE = '40001';
    END IF;

    RETURN public.ack_confirm_receipt(
        p_receipt_id,
        p_expected_revision,
        'payer'
    );
END;
$$;

REVOKE ALL ON TABLE public.payer_portal_pin_attempts
    FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.payer_portal_pin_attempts
    TO service_role;

REVOKE ALL ON FUNCTION public.ack_reserve_payer_portal_attempt(uuid, text, text, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ack_finalize_payer_portal_attempt(uuid, text, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ack_complete_payer_portal_unlock(uuid, uuid, integer, text, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ack_confirm_payer_receipt(uuid, integer, uuid)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ack_reserve_payer_portal_attempt(uuid, text, text, uuid)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.ack_finalize_payer_portal_attempt(uuid, text, text)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.ack_complete_payer_portal_unlock(uuid, uuid, integer, text, text)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.ack_confirm_payer_receipt(uuid, integer, uuid)
    TO service_role;

COMMIT;
