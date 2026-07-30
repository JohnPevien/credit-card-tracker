import { randomUUID } from "node:crypto";

import { generatePin, hashPin } from "@/lib/auth/pin";
import type {
    PayerPortalAdminView,
    PayerPortalCredentialResult,
    PortalAdminAction,
} from "../types";
import {
    ReceiptNotFoundError,
    ReceiptUnexpectedError,
    ReceiptValidationError,
} from "./http";

export type ReceiptDatabaseError = {
    code?: string;
    message?: string;
    status?: number;
};

export type ReceiptDatabaseResult = {
    data: unknown;
    error: ReceiptDatabaseError | null;
};

export interface ReceiptQuery extends PromiseLike<ReceiptDatabaseResult> {
    select(...args: unknown[]): ReceiptQuery;
    insert(...args: unknown[]): ReceiptQuery;
    update(...args: unknown[]): ReceiptQuery;
    eq(...args: unknown[]): ReceiptQuery;
    gte(...args: unknown[]): ReceiptQuery;
    lte(...args: unknown[]): ReceiptQuery;
    or(...args: unknown[]): ReceiptQuery;
    order(...args: unknown[]): ReceiptQuery;
    maybeSingle(...args: unknown[]): ReceiptQuery;
}

export interface ReceiptDataClient {
    from(table: string): ReceiptQuery;
    rpc(
        name: string,
        args: Record<string, unknown>,
    ): PromiseLike<ReceiptDatabaseResult>;
}

type PortalDependencies = {
    generatePin?: () => string;
    hashPin?: (pin: string) => Promise<string>;
    createPublicId?: () => string;
    now?: () => Date;
};

const PORTAL_SELECT = [
    "person_id",
    "public_id",
    "credential_version",
    "revoked_at",
    "last_accessed_at",
    "created_at",
    "updated_at",
    "persons!inner(name)",
].join(",");

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const stringValue = (row: Record<string, unknown>, key: string) =>
    typeof row[key] === "string" ? row[key] : "";

const nullableStringValue = (row: Record<string, unknown>, key: string) =>
    typeof row[key] === "string" ? row[key] : null;

const serializePortal = (value: unknown): PayerPortalAdminView => {
    const row = asRecord(value);
    const personRelation = Array.isArray(row.persons)
        ? asRecord(row.persons[0])
        : asRecord(row.persons);

    return {
        personId: stringValue(row, "person_id"),
        payerName: stringValue(personRelation, "name"),
        publicId: stringValue(row, "public_id"),
        credentialVersion: Number(row.credential_version),
        revokedAt: nullableStringValue(row, "revoked_at"),
        lastAccessedAt: nullableStringValue(row, "last_accessed_at"),
        createdAt: stringValue(row, "created_at"),
        updatedAt: stringValue(row, "updated_at"),
    };
};

const throwPortalError = (
    error: ReceiptDatabaseError,
    fallback: string,
): never => {
    if (error.code === "P0002") {
        throw new ReceiptNotFoundError(error.message ?? fallback, {
            cause: error,
        });
    }

    if (error.code === "22023" || error.code === "23503") {
        throw new ReceiptValidationError(error.message ?? fallback, {
            cause: error,
        });
    }

    throw new ReceiptUnexpectedError(fallback, { cause: error });
};

export function createPortalAdminService(
    client: ReceiptDataClient,
    dependencies: PortalDependencies = {},
) {
    const createCredentialPin = dependencies.generatePin ?? generatePin;
    const hashCredentialPin = dependencies.hashPin ?? hashPin;
    const createPublicId = dependencies.createPublicId ?? randomUUID;
    const now = dependencies.now ?? (() => new Date());

    const getPortalAccess = async (
        personId: string,
    ): Promise<PayerPortalAdminView | null> => {
        const { data, error } = await client
            .from("payer_portal_access")
            .select(PORTAL_SELECT)
            .eq("person_id", personId)
            .maybeSingle();

        if (error) {
            throwPortalError(error, "Unable to load payer portal access");
        }

        return data ? serializePortal(data) : null;
    };

    const writePortalEvent = async (
        personId: string,
        eventType: string,
    ): Promise<void> => {
        const { error } = await client
            .from("acknowledgement_receipt_events")
            .insert({
                portal_person_id: personId,
                event_type: eventType,
                actor_role: "receiver",
                details: {},
            });

        if (error) {
            throwPortalError(error, "Unable to record payer portal event");
        }
    };

    const selectWrittenPortal = (query: ReceiptQuery) =>
        query.select(PORTAL_SELECT).maybeSingle();

    const managePortalAccess = async (
        personId: string,
        action: PortalAdminAction,
    ): Promise<PayerPortalCredentialResult> => {
        const existing = await getPortalAccess(personId);

        if (action.type === "generate-pin") {
            if (existing) {
                return { portal: existing, pin: null };
            }

            const pin = createCredentialPin();
            const pinHash = await hashCredentialPin(pin);
            const { data, error } = await selectWrittenPortal(
                client.from("payer_portal_access").insert({
                    person_id: personId,
                    public_id: createPublicId(),
                    pin_hash: pinHash,
                }),
            );

            if (error?.code === "23505") {
                const racedPortal = await getPortalAccess(personId);
                if (racedPortal) {
                    return { portal: racedPortal, pin: null };
                }
            }

            if (error) {
                throwPortalError(error, "Unable to create payer portal access");
            }
            if (!data) {
                throw new ReceiptUnexpectedError(
                    "Payer portal creation returned no row",
                );
            }

            return { portal: serializePortal(data), pin };
        }

        if (!existing) {
            throw new ReceiptNotFoundError("Payer portal access was not found");
        }

        let changes: Record<string, unknown>;
        let eventType: string;
        let plaintextPin: string | null = null;

        switch (action.type) {
            case "reset-pin": {
                plaintextPin = createCredentialPin();
                changes = {
                    pin_hash: await hashCredentialPin(plaintextPin),
                    credential_version: existing.credentialVersion + 1,
                };
                eventType = "portal_pin_reset";
                break;
            }
            case "rotate-link":
                changes = {
                    public_id: createPublicId(),
                    credential_version: existing.credentialVersion + 1,
                };
                eventType = "portal_link_rotated";
                break;
            case "revoke":
                changes = { revoked_at: now().toISOString() };
                eventType = "portal_revoked";
                break;
            case "reactivate":
                changes = { revoked_at: null };
                eventType = "portal_reactivated";
                break;
        }

        const { data, error } = await selectWrittenPortal(
            client
                .from("payer_portal_access")
                .update(changes)
                .eq("person_id", personId),
        );
        if (error) {
            throwPortalError(error, "Unable to update payer portal access");
        }
        if (!data) {
            throw new ReceiptNotFoundError("Payer portal access was not found");
        }

        await writePortalEvent(personId, eventType);
        return { portal: serializePortal(data), pin: plaintextPin };
    };

    return { getPortalAccess, managePortalAccess };
}

const getDefaultService = async () => {
    const { getServerSupabase } = await import("@/lib/supabase/server");
    return createPortalAdminService(
        getServerSupabase() as unknown as ReceiptDataClient,
    );
};

export async function getPortalAccess(
    personId: string,
): Promise<PayerPortalAdminView | null> {
    return (await getDefaultService()).getPortalAccess(personId);
}

export async function managePortalAccess(
    personId: string,
    action: PortalAdminAction,
): Promise<PayerPortalCredentialResult> {
    return (await getDefaultService()).managePortalAccess(personId, action);
}
