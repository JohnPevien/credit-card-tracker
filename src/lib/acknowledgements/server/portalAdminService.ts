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

export const serializePortalAdminView = (
    value: unknown,
): PayerPortalAdminView => {
    const row = asRecord(value);
    const personRelation = Array.isArray(row.persons)
        ? asRecord(row.persons[0])
        : asRecord(row.persons);

    return {
        personId: stringValue(row, "person_id"),
        payerName:
            stringValue(row, "payer_name") ||
            stringValue(personRelation, "name"),
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

        return data ? serializePortalAdminView(data) : null;
    };

    const managePortalAccess = async (
        personId: string,
        action: PortalAdminAction,
    ): Promise<PayerPortalCredentialResult> => {
        let plaintextPin: string | null = null;
        let pinHash: string | null = null;
        let publicId: string | null = null;

        if (action.type === "generate-pin" || action.type === "reset-pin") {
            plaintextPin = createCredentialPin();
            pinHash = await hashCredentialPin(plaintextPin);
        }
        if (action.type === "generate-pin" || action.type === "rotate-link") {
            publicId = createPublicId();
        }

        const { data, error } = await client.rpc("ack_manage_portal_access", {
            p_person_id: personId,
            p_action: action.type,
            p_pin_hash: pinHash,
            p_public_id: publicId,
        });
        if (error) {
            throwPortalError(error, "Unable to manage payer portal access");
        }
        if (!data) {
            throw new ReceiptUnexpectedError(
                "Payer portal mutation returned no result",
            );
        }

        const payload = asRecord(Array.isArray(data) ? data[0] : data);
        const credentialChanged = payload.credential_changed === true;

        return {
            portal: serializePortalAdminView(payload.portal),
            pin:
                credentialChanged &&
                (action.type === "generate-pin" || action.type === "reset-pin")
                    ? plaintextPin
                    : null,
        };
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
