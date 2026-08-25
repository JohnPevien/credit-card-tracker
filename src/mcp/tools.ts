import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TransactionService } from "@/lib/services/transactionService";
import { PurchaseService } from "@/lib/services/purchaseService";
import { DataService } from "@/lib/services/dataService";
import { PersonService } from "@/lib/services/personService";
import { CreditCardService } from "@/lib/services/creditCardService";

const idSchema = z.string().uuid();
const dateSchema = z.string().date();
const nonEmptyString = z.string().trim().min(1);

const readOnlyAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
} as const;

const createAnnotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
} as const;

const updateAnnotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
} as const;

const deleteAnnotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
} as const;

const creditCardFields = {
    credit_card_name: nonEmptyString,
    last_four_digits: z.string().regex(/^\d{4}$/),
    cardholder_name: nonEmptyString,
    issuer: nonEmptyString,
    is_supplementary: z.boolean(),
};

const createCreditCardInput = z
    .object({
        ...creditCardFields,
        principal_card_id: idSchema.nullable().default(null),
    })
    .refine(
        ({ is_supplementary, principal_card_id }) =>
            is_supplementary === (principal_card_id !== null),
        {
            message:
                "principal_card_id is required for supplementary cards and must be null otherwise",
            path: ["principal_card_id"],
        },
    );

const updateCreditCardInput = z
    .object({
        id: idSchema,
        ...creditCardFields,
        principal_card_id: idSchema.nullable(),
    })
    .refine(
        ({ is_supplementary, principal_card_id }) =>
            is_supplementary === (principal_card_id !== null),
        {
            message:
                "principal_card_id is required for supplementary cards and must be null otherwise",
            path: ["principal_card_id"],
        },
    );

function jsonResult(data: unknown) {
    return {
        content: [
            { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
    };
}

function errorResult(message: string) {
    return {
        isError: true,
        content: [{ type: "text" as const, text: message }],
    };
}

export function createMcpServer() {
    const server = new McpServer({
        name: "credit-card-tracker",
        version: "0.1.0",
    });

    // Transactions
    server.registerTool(
        "list_transactions",
        {
            description: "List transactions with optional filters",
            inputSchema: {
                person_id: idSchema.optional(),
                credit_card_id: idSchema.optional(),
                description: nonEmptyString.optional(),
                date_from: dateSchema.optional(),
                date_to: dateSchema.optional(),
                paid: z.boolean().optional(),
            },
            annotations: readOnlyAnnotations,
        },
        async (args) => {
            try {
                const data = await TransactionService.loadTransactions(args);
                return jsonResult(data);
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "get_transaction",
        {
            description: "Get a single transaction by id",
            inputSchema: { id: idSchema },
            annotations: readOnlyAnnotations,
        },
        async ({ id }) => {
            try {
                const data = await TransactionService.loadTransaction(id);
                return jsonResult(data);
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "set_transaction_paid",
        {
            description: "Set the paid status of a transaction",
            inputSchema: { id: idSchema, paid: z.boolean() },
            annotations: updateAnnotations,
        },
        async ({ id, paid }) => {
            try {
                await PurchaseService.updateTransactionPaidStatus(id, paid);
                return jsonResult({ success: true, id, paid });
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    // Purchases
    server.registerTool(
        "list_purchases",
        {
            description: "List all purchases",
            inputSchema: {},
            annotations: readOnlyAnnotations,
        },
        async () => {
            try {
                const data = await DataService.loadPurchases();
                return jsonResult(data);
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "get_purchase",
        {
            description: "Get purchase details with related transactions",
            inputSchema: { id: idSchema },
            annotations: readOnlyAnnotations,
        },
        async ({ id }) => {
            try {
                const data = await PurchaseService.loadPurchaseDetails(id);
                return jsonResult(data);
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "create_purchase",
        {
            description:
                "Create a purchase and generate its installment transactions",
            inputSchema: {
                credit_card_id: idSchema,
                person_id: idSchema,
                purchase_date: dateSchema,
                billing_start_date: dateSchema,
                total_amount: z.number().positive(),
                description: nonEmptyString,
                num_installments: z.number().int().min(1).default(1),
                is_bnpl: z.boolean().default(false),
            },
            annotations: createAnnotations,
        },
        async (args) => {
            try {
                await DataService.createPurchaseWithTransactions(args);
                return jsonResult({ success: true });
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "update_purchase",
        {
            description:
                "Update a purchase and synchronize its installment transactions",
            inputSchema: {
                id: idSchema,
                description: nonEmptyString.optional(),
                purchase_date: dateSchema.optional(),
                is_bnpl: z.boolean().optional(),
                credit_card_id: idSchema.optional(),
                person_id: idSchema.optional(),
                total_amount: z.number().positive().optional(),
                billing_start_date: dateSchema.optional(),
                num_installments: z.number().int().min(1).optional(),
            },
            annotations: updateAnnotations,
        },
        async ({ id, ...data }) => {
            try {
                const result = await PurchaseService.updatePurchaseFull(
                    id,
                    data,
                );
                return jsonResult(result);
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "delete_purchase",
        {
            description: "Delete a purchase and its transactions",
            inputSchema: { id: idSchema },
            annotations: deleteAnnotations,
        },
        async ({ id }) => {
            try {
                await DataService.deletePurchaseAndTransactions(id);
                return jsonResult({ success: true, id });
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    // Persons
    server.registerTool(
        "list_persons",
        {
            description: "List all persons",
            inputSchema: {},
            annotations: readOnlyAnnotations,
        },
        async () => {
            try {
                const data = await PersonService.loadPersons();
                return jsonResult(data);
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "create_person",
        {
            description: "Create a person",
            inputSchema: { name: nonEmptyString },
            annotations: createAnnotations,
        },
        async ({ name }) => {
            try {
                await PersonService.addPerson({ name });
                return jsonResult({ success: true, name });
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "update_person",
        {
            description: "Update a person",
            inputSchema: { id: idSchema, name: nonEmptyString },
            annotations: updateAnnotations,
        },
        async ({ id, name }) => {
            try {
                await PersonService.updatePerson(id, { name });
                return jsonResult({ success: true, id, name });
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "delete_person",
        {
            description: "Delete a person",
            inputSchema: { id: idSchema },
            annotations: deleteAnnotations,
        },
        async ({ id }) => {
            try {
                await PersonService.deletePerson(id);
                return jsonResult({ success: true, id });
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    // Credit cards
    server.registerTool(
        "list_credit_cards",
        {
            description: "List all credit cards",
            inputSchema: {},
            annotations: readOnlyAnnotations,
        },
        async () => {
            try {
                const data = await CreditCardService.loadCards();
                return jsonResult(data);
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "create_credit_card",
        {
            description: "Create a credit card",
            inputSchema: createCreditCardInput,
            annotations: createAnnotations,
        },
        async (args) => {
            try {
                await CreditCardService.createCard({
                    credit_card_name: args.credit_card_name,
                    last_four_digits: args.last_four_digits,
                    cardholder_name: args.cardholder_name,
                    issuer: args.issuer,
                    is_supplementary: args.is_supplementary,
                    principal_card_id: args.principal_card_id ?? null,
                });
                return jsonResult({ success: true });
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "update_credit_card",
        {
            description: "Update a credit card",
            inputSchema: updateCreditCardInput,
            annotations: updateAnnotations,
        },
        async ({
            id,
            credit_card_name,
            last_four_digits,
            cardholder_name,
            issuer,
            is_supplementary,
            principal_card_id,
        }) => {
            try {
                await CreditCardService.updateCard(id, {
                    credit_card_name,
                    last_four_digits,
                    cardholder_name,
                    issuer,
                    is_supplementary,
                    principal_card_id: principal_card_id ?? null,
                });
                return jsonResult({ success: true, id });
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );

    server.registerTool(
        "delete_credit_card",
        {
            description: "Delete a credit card",
            inputSchema: { id: idSchema },
            annotations: deleteAnnotations,
        },
        async ({ id }) => {
            try {
                await CreditCardService.deleteCard(id);
                return jsonResult({ success: true, id });
            } catch (err) {
                return errorResult(
                    err instanceof Error ? err.message : String(err),
                );
            }
        },
    );
    return server;
}
