-- Atomic payer-portal credential administration and publish-time provisioning.

BEGIN;

CREATE OR REPLACE FUNCTION public.ack_manage_portal_access(
    p_person_id uuid,
    p_action text,
    p_pin_hash text,
    p_public_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_portal public.payer_portal_access%ROWTYPE;
    v_payer_name text;
    v_portal_exists boolean;
    v_changed boolean := false;
    v_event_type text;
BEGIN
    IF p_action NOT IN (
        'generate-pin',
        'reset-pin',
        'rotate-link',
        'revoke',
        'reactivate'
    ) THEN
        RAISE EXCEPTION 'invalid portal administration action'
            USING ERRCODE = '22023';
    END IF;

    SELECT person.name
    INTO v_payer_name
    FROM public.persons person
    WHERE person.id = p_person_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE no_data_found;
    END IF;

    SELECT *
    INTO v_portal
    FROM public.payer_portal_access
    WHERE person_id = p_person_id
    FOR UPDATE;
    v_portal_exists := FOUND;

    IF p_action = 'generate-pin' THEN
        IF NOT v_portal_exists THEN
            IF p_pin_hash IS NULL OR length(p_pin_hash) < 16 THEN
                RAISE EXCEPTION 'a valid PIN hash is required'
                    USING ERRCODE = '22023';
            END IF;
            IF p_public_id IS NULL THEN
                RAISE EXCEPTION 'a public portal id is required'
                    USING ERRCODE = '22023';
            END IF;

            INSERT INTO public.payer_portal_access (
                person_id,
                public_id,
                pin_hash
            )
            VALUES (
                p_person_id,
                p_public_id,
                p_pin_hash
            )
            ON CONFLICT (person_id) DO NOTHING
            RETURNING * INTO v_portal;

            IF FOUND THEN
                v_changed := true;
                v_event_type := 'portal_pin_generated';
            ELSE
                SELECT *
                INTO STRICT v_portal
                FROM public.payer_portal_access
                WHERE person_id = p_person_id
                FOR UPDATE;
            END IF;
        END IF;
    ELSIF NOT v_portal_exists THEN
        RAISE no_data_found;
    ELSIF p_action = 'reset-pin' THEN
        IF p_pin_hash IS NULL OR length(p_pin_hash) < 16 THEN
            RAISE EXCEPTION 'a valid PIN hash is required'
                USING ERRCODE = '22023';
        END IF;

        UPDATE public.payer_portal_access
        SET
            pin_hash = p_pin_hash,
            credential_version = credential_version + 1
        WHERE person_id = p_person_id
        RETURNING * INTO v_portal;
        v_changed := true;
        v_event_type := 'portal_pin_reset';
    ELSIF p_action = 'rotate-link' THEN
        IF p_public_id IS NULL THEN
            RAISE EXCEPTION 'a public portal id is required'
                USING ERRCODE = '22023';
        END IF;

        UPDATE public.payer_portal_access
        SET
            public_id = p_public_id,
            credential_version = credential_version + 1
        WHERE person_id = p_person_id
        RETURNING * INTO v_portal;
        v_changed := true;
        v_event_type := 'portal_link_rotated';
    ELSIF p_action = 'revoke' THEN
        IF v_portal.revoked_at IS NULL THEN
            UPDATE public.payer_portal_access
            SET
                revoked_at = clock_timestamp(),
                credential_version = credential_version + 1
            WHERE person_id = p_person_id
            RETURNING * INTO v_portal;
            v_changed := true;
            v_event_type := 'portal_revoked';
        END IF;
    ELSIF p_action = 'reactivate' THEN
        IF v_portal.revoked_at IS NOT NULL THEN
            UPDATE public.payer_portal_access
            SET revoked_at = NULL
            WHERE person_id = p_person_id
            RETURNING * INTO v_portal;
            v_changed := true;
            v_event_type := 'portal_reactivated';
        END IF;
    END IF;

    IF v_event_type IS NOT NULL THEN
        INSERT INTO public.acknowledgement_receipt_events (
            portal_person_id,
            event_type,
            actor_role,
            details
        )
        VALUES (
            p_person_id,
            v_event_type,
            'receiver',
            jsonb_build_object(
                'credential_version',
                v_portal.credential_version
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'portal',
        jsonb_build_object(
            'person_id', v_portal.person_id,
            'payer_name', v_payer_name,
            'public_id', v_portal.public_id,
            'credential_version', v_portal.credential_version,
            'revoked_at', v_portal.revoked_at,
            'last_accessed_at', v_portal.last_accessed_at,
            'created_at', v_portal.created_at,
            'updated_at', v_portal.updated_at
        ),
        'credential_changed',
        v_changed
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_publish_receipt_with_portal(
    p_receipt_id uuid,
    p_expected_revision integer,
    p_pin_hash text,
    p_public_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_receipt public.acknowledgement_receipts%ROWTYPE;
    v_portal public.payer_portal_access%ROWTYPE;
    v_payer_name text;
    v_portal_created boolean := false;
BEGIN
    SELECT *
    INTO v_receipt
    FROM public.acknowledgement_receipts
    WHERE id = p_receipt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE no_data_found;
    END IF;

    IF v_receipt.revision_number <> p_expected_revision THEN
        RAISE EXCEPTION 'acknowledgement receipt revision conflict'
            USING ERRCODE = '40001';
    END IF;

    IF v_receipt.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'voided receipts cannot be published'
            USING ERRCODE = '55000';
    END IF;

    SELECT person.name
    INTO STRICT v_payer_name
    FROM public.persons person
    WHERE person.id = v_receipt.payer_person_id
    FOR UPDATE;

    SELECT *
    INTO v_portal
    FROM public.payer_portal_access
    WHERE person_id = v_receipt.payer_person_id
    FOR UPDATE;

    IF NOT FOUND THEN
        IF p_pin_hash IS NULL OR length(p_pin_hash) < 16 THEN
            RAISE EXCEPTION 'a valid PIN hash is required'
                USING ERRCODE = '22023';
        END IF;
        IF p_public_id IS NULL THEN
            RAISE EXCEPTION 'a public portal id is required'
                USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.payer_portal_access (
            person_id,
            public_id,
            pin_hash
        )
        VALUES (
            v_receipt.payer_person_id,
            p_public_id,
            p_pin_hash
        )
        ON CONFLICT (person_id) DO NOTHING
        RETURNING * INTO v_portal;
        v_portal_created := FOUND;

        IF NOT v_portal_created THEN
            SELECT *
            INTO STRICT v_portal
            FROM public.payer_portal_access
            WHERE person_id = v_receipt.payer_person_id
            FOR UPDATE;
        ELSE
            INSERT INTO public.acknowledgement_receipt_events (
                portal_person_id,
                event_type,
                actor_role,
                details
            )
            VALUES (
                v_receipt.payer_person_id,
                'portal_pin_generated',
                'receiver',
                jsonb_build_object(
                    'credential_version',
                    v_portal.credential_version,
                    'source',
                    'receipt_publish'
                )
            );
        END IF;
    END IF;

    IF v_receipt.published_at IS NULL THEN
        UPDATE public.acknowledgement_receipts
        SET published_at = clock_timestamp()
        WHERE id = p_receipt_id
        RETURNING * INTO v_receipt;

        INSERT INTO public.acknowledgement_receipt_events (
            receipt_id,
            event_type,
            actor_role,
            revision_number
        )
        VALUES (
            p_receipt_id,
            'published',
            'receiver',
            v_receipt.revision_number
        );
    END IF;

    RETURN jsonb_build_object(
        'receipt_id',
        v_receipt.id,
        'portal',
        jsonb_build_object(
            'person_id', v_portal.person_id,
            'payer_name', v_payer_name,
            'public_id', v_portal.public_id,
            'credential_version', v_portal.credential_version,
            'revoked_at', v_portal.revoked_at,
            'last_accessed_at', v_portal.last_accessed_at,
            'created_at', v_portal.created_at,
            'updated_at', v_portal.updated_at
        ),
        'portal_created',
        v_portal_created
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ack_manage_portal_access(uuid, text, text, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ack_publish_receipt_with_portal(uuid, integer, text, uuid)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ack_manage_portal_access(uuid, text, text, uuid)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.ack_publish_receipt_with_portal(uuid, integer, text, uuid)
    TO service_role;

COMMIT;
