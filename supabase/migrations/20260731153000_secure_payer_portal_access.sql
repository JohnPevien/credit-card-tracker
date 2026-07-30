-- Durable, concurrency-safe payer portal PIN verification.
-- A reservation is recorded as a failure before application-side scrypt work.
-- Successful verification removes the relevant window in one transaction.

BEGIN;

ALTER TABLE public.payer_portal_pin_attempts
    ALTER COLUMN portal_person_id DROP NOT NULL;

ALTER TABLE public.payer_portal_pin_attempts
    ADD COLUMN IF NOT EXISTS reservation_id uuid DEFAULT gen_random_uuid();

ALTER TABLE public.payer_portal_pin_attempts
    ALTER COLUMN reservation_id SET NOT NULL;

ALTER TABLE public.payer_portal_pin_attempts
    ADD CONSTRAINT payer_portal_pin_attempts_reservation_key
        UNIQUE (reservation_id);

CREATE OR REPLACE FUNCTION public.ack_reserve_payer_portal_attempt(
    p_public_id uuid,
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
    IF p_network_hash IS NULL
       OR p_network_hash !~ '^[0-9a-f]{64}$'
       OR p_reservation_id IS NULL THEN
        RAISE EXCEPTION 'invalid portal verification reservation'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_portal
    FROM public.payer_portal_access
    WHERE public_id = p_public_id;

    -- Unknown public IDs share a stable missing-portal bucket per obscured
    -- network address. Known portals receive an independent bucket.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            coalesce(v_portal.person_id::text, 'unknown')
                || ':'
                || p_network_hash,
            0
        )
    );

    DELETE FROM public.payer_portal_pin_attempts
    WHERE portal_person_id IS NOT DISTINCT FROM v_portal.person_id
      AND network_hash = p_network_hash
      AND attempted_at <= clock_timestamp() - interval '15 minutes';

    SELECT count(*), min(attempted_at)
    INTO v_failure_count, v_oldest_failure
    FROM public.payer_portal_pin_attempts
    WHERE portal_person_id IS NOT DISTINCT FROM v_portal.person_id
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
        network_hash,
        succeeded,
        reservation_id,
        attempted_at
    )
    VALUES (
        v_portal.person_id,
        p_network_hash,
        false,
        p_reservation_id,
        clock_timestamp()
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

CREATE OR REPLACE FUNCTION public.ack_complete_payer_portal_unlock(
    p_reservation_id uuid,
    p_public_id uuid,
    p_credential_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_attempt public.payer_portal_pin_attempts%ROWTYPE;
    v_portal public.payer_portal_access%ROWTYPE;
BEGIN
    SELECT *
    INTO v_attempt
    FROM public.payer_portal_pin_attempts
    WHERE reservation_id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND OR v_attempt.portal_person_id IS NULL THEN
        RETURN NULL;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            v_attempt.portal_person_id::text
                || ':'
                || v_attempt.network_hash,
            0
        )
    );

    SELECT *
    INTO v_portal
    FROM public.payer_portal_access
    WHERE person_id = v_attempt.portal_person_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_portal.credential_version <> p_credential_version
       OR v_portal.public_id <> p_public_id
       OR v_portal.revoked_at IS NOT NULL THEN
        RETURN NULL;
    END IF;

    DELETE FROM public.payer_portal_pin_attempts
    WHERE portal_person_id = v_attempt.portal_person_id
      AND network_hash = v_attempt.network_hash;

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

REVOKE ALL ON FUNCTION public.ack_reserve_payer_portal_attempt(uuid, text, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ack_complete_payer_portal_unlock(uuid, uuid, integer)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ack_reserve_payer_portal_attempt(uuid, text, uuid)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.ack_complete_payer_portal_unlock(uuid, uuid, integer)
    TO service_role;

COMMIT;
