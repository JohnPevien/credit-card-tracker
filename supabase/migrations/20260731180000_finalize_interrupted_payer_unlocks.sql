-- Finalize an unlock reservation when its credential changes after PIN
-- verification but before transactional completion.

BEGIN;

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
       OR v_portal.public_id IS DISTINCT FROM p_public_id
       OR v_portal.credential_version <> p_credential_version
       OR v_portal.revoked_at IS NOT NULL THEN
        UPDATE public.payer_portal_pin_attempts
        SET finalized_at = clock_timestamp()
        WHERE id = v_attempt.id;

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

REVOKE ALL ON FUNCTION public.ack_complete_payer_portal_unlock(uuid, uuid, integer, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_complete_payer_portal_unlock(uuid, uuid, integer, text, text)
    TO service_role;

COMMIT;
