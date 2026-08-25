import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreditCardService } from "@/lib/services/creditCardService";
import { DataService } from "@/lib/services/dataService";
import { PersonService } from "@/lib/services/personService";
import { PurchaseService } from "@/lib/services/purchaseService";
import { TransactionService } from "@/lib/services/transactionService";
import type { CreditCard, Person, Purchase, Transaction } from "@/lib/supabase";
import { createMcpServer } from "@/mcp/tools";

const ID = "11111111-1111-4111-8111-111111111111";
const RELATED_ID = "22222222-2222-4222-8222-222222222222";

type ToolResult = {
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
};

function parseResult(result: ToolResult): unknown {
    const text = result.content.find((item) => item.type === "text")?.text;
    if (!text) throw new Error("Expected text content");
    return JSON.parse(text);
}

const person: Person = { id: ID, name: "Chi", slug: "chi" };
const card: CreditCard = {
    id: ID,
    credit_card_name: "Primary",
    last_four_digits: "1234",
    cardholder_name: "Chi",
    issuer: "Visa",
    is_supplementary: false,
};
const purchase: Purchase = {
    id: ID,
    credit_card_id: ID,
    person_id: ID,
    purchase_date: "2026-08-26",
    billing_start_date: "2026-09-01",
    total_amount: 100,
    description: "Groceries",
    num_installments: 1,
    is_bnpl: false,
};
const transaction: Transaction = {
    id: ID,
    credit_card_id: ID,
    person_id: ID,
    purchase_id: ID,
    date: "2026-09-01",
    amount: 100,
    description: "Groceries",
    paid: false,
};

describe("MCP tools", () => {
    let server: McpServer;
    let client: Client;

    beforeEach(async () => {
        const [clientTransport, serverTransport] =
            InMemoryTransport.createLinkedPair();
        server = createMcpServer();
        client = new Client({ name: "mcp-tools-test", version: "0.1.0" });
        await Promise.all([
            server.connect(serverTransport),
            client.connect(clientTransport),
        ]);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await Promise.allSettled([client.close(), server.close()]);
    });

    it("registers the complete tool set with safety annotations", async () => {
        const { tools } = await client.listTools();
        const names = tools.map(({ name }) => name).sort();

        expect(names).toEqual([
            "create_credit_card",
            "create_person",
            "create_purchase",
            "delete_credit_card",
            "delete_person",
            "delete_purchase",
            "get_purchase",
            "get_transaction",
            "list_credit_cards",
            "list_persons",
            "list_purchases",
            "list_transactions",
            "set_transaction_paid",
            "update_credit_card",
            "update_person",
            "update_purchase",
        ]);

        for (const name of [
            "get_purchase",
            "get_transaction",
            "list_credit_cards",
            "list_persons",
            "list_purchases",
            "list_transactions",
        ]) {
            expect(
                tools.find((tool) => tool.name === name)?.annotations,
            ).toMatchObject({
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            });
        }

        for (const name of [
            "delete_credit_card",
            "delete_person",
            "delete_purchase",
        ]) {
            expect(
                tools.find((tool) => tool.name === name)?.annotations,
            ).toMatchObject({
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
                openWorldHint: false,
            });
        }
    });

    it("delegates transaction and purchase tools with validated arguments", async () => {
        const loadTransactions = vi
            .spyOn(TransactionService, "loadTransactions")
            .mockResolvedValue([transaction]);
        vi.spyOn(TransactionService, "loadTransaction").mockResolvedValue(
            transaction,
        );
        vi.spyOn(
            PurchaseService,
            "updateTransactionPaidStatus",
        ).mockResolvedValue();
        vi.spyOn(DataService, "loadPurchases").mockResolvedValue([purchase]);
        vi.spyOn(PurchaseService, "loadPurchaseDetails").mockResolvedValue({
            purchase,
            transactions: [transaction],
        });
        const createPurchase = vi
            .spyOn(DataService, "createPurchaseWithTransactions")
            .mockResolvedValue();
        vi.spyOn(PurchaseService, "updatePurchaseFull").mockResolvedValue({
            purchase,
            transactions: [transaction],
        });
        vi.spyOn(
            DataService,
            "deletePurchaseAndTransactions",
        ).mockResolvedValue();

        const listResult = (await client.callTool({
            name: "list_transactions",
            arguments: { person_id: ID, paid: false },
        })) as ToolResult;
        expect(parseResult(listResult)).toEqual([transaction]);
        expect(loadTransactions).toHaveBeenCalledWith({
            person_id: ID,
            paid: false,
        });

        await client.callTool({
            name: "get_transaction",
            arguments: { id: ID },
        });
        await client.callTool({
            name: "set_transaction_paid",
            arguments: { id: ID, paid: true },
        });
        await client.callTool({ name: "list_purchases", arguments: {} });
        await client.callTool({ name: "get_purchase", arguments: { id: ID } });
        await client.callTool({
            name: "create_purchase",
            arguments: {
                credit_card_id: ID,
                person_id: ID,
                purchase_date: "2026-08-26",
                billing_start_date: "2026-09-01",
                total_amount: 100,
                description: "Groceries",
            },
        });
        expect(createPurchase).toHaveBeenCalledWith({
            credit_card_id: ID,
            person_id: ID,
            purchase_date: "2026-08-26",
            billing_start_date: "2026-09-01",
            total_amount: 100,
            description: "Groceries",
            num_installments: 1,
            is_bnpl: false,
        });

        await client.callTool({
            name: "update_purchase",
            arguments: { id: ID, description: "Updated" },
        });
        await client.callTool({
            name: "delete_purchase",
            arguments: { id: ID },
        });

        expect(TransactionService.loadTransaction).toHaveBeenCalledWith(ID);
        expect(
            PurchaseService.updateTransactionPaidStatus,
        ).toHaveBeenCalledWith(ID, true);
        expect(DataService.loadPurchases).toHaveBeenCalledOnce();
        expect(PurchaseService.loadPurchaseDetails).toHaveBeenCalledWith(ID);
        expect(PurchaseService.updatePurchaseFull).toHaveBeenCalledWith(ID, {
            description: "Updated",
        });
        expect(DataService.deletePurchaseAndTransactions).toHaveBeenCalledWith(
            ID,
        );
    });

    it("delegates person and credit-card tools without dropping relationships", async () => {
        vi.spyOn(PersonService, "loadPersons").mockResolvedValue([person]);
        vi.spyOn(PersonService, "addPerson").mockResolvedValue();
        vi.spyOn(PersonService, "updatePerson").mockResolvedValue();
        vi.spyOn(PersonService, "deletePerson").mockResolvedValue();
        vi.spyOn(CreditCardService, "loadCards").mockResolvedValue([card]);
        vi.spyOn(CreditCardService, "createCard").mockResolvedValue();
        const updateCard = vi
            .spyOn(CreditCardService, "updateCard")
            .mockResolvedValue();
        vi.spyOn(CreditCardService, "deleteCard").mockResolvedValue();

        await client.callTool({ name: "list_persons", arguments: {} });
        await client.callTool({
            name: "create_person",
            arguments: { name: " New Person " },
        });
        await client.callTool({
            name: "update_person",
            arguments: { id: ID, name: "Updated Person" },
        });
        await client.callTool({ name: "delete_person", arguments: { id: ID } });
        await client.callTool({ name: "list_credit_cards", arguments: {} });
        await client.callTool({
            name: "create_credit_card",
            arguments: {
                credit_card_name: "Primary",
                last_four_digits: "1234",
                cardholder_name: "Chi",
                issuer: "Visa",
                is_supplementary: false,
            },
        });
        await client.callTool({
            name: "update_credit_card",
            arguments: {
                id: ID,
                credit_card_name: "Supplementary",
                last_four_digits: "5678",
                cardholder_name: "Chi",
                issuer: "Visa",
                is_supplementary: true,
                principal_card_id: RELATED_ID,
            },
        });
        await client.callTool({
            name: "delete_credit_card",
            arguments: { id: ID },
        });

        expect(PersonService.addPerson).toHaveBeenCalledWith({
            name: "New Person",
        });
        expect(PersonService.updatePerson).toHaveBeenCalledWith(ID, {
            name: "Updated Person",
        });
        expect(updateCard).toHaveBeenCalledWith(ID, {
            credit_card_name: "Supplementary",
            last_four_digits: "5678",
            cardholder_name: "Chi",
            issuer: "Visa",
            is_supplementary: true,
            principal_card_id: RELATED_ID,
        });
    });

    it("rejects invalid identifiers and card relationships before service calls", async () => {
        const loadTransaction = vi.spyOn(TransactionService, "loadTransaction");
        const createCard = vi.spyOn(CreditCardService, "createCard");
        const updateCard = vi.spyOn(CreditCardService, "updateCard");

        const invalidId = (await client.callTool({
            name: "get_transaction",
            arguments: { id: "not-a-uuid" },
        })) as ToolResult;
        const missingPrincipal = (await client.callTool({
            name: "create_credit_card",
            arguments: {
                credit_card_name: "Supplementary",
                last_four_digits: "1234",
                cardholder_name: "Chi",
                issuer: "Visa",
                is_supplementary: true,
            },
        })) as ToolResult;
        const omittedRelationship = (await client.callTool({
            name: "update_credit_card",
            arguments: {
                id: ID,
                credit_card_name: "Supplementary",
                last_four_digits: "5678",
                cardholder_name: "Chi",
                issuer: "Visa",
                is_supplementary: true,
            },
        })) as ToolResult;

        expect(invalidId.isError).toBe(true);
        expect(missingPrincipal.isError).toBe(true);
        expect(omittedRelationship.isError).toBe(true);
        expect(loadTransaction).not.toHaveBeenCalled();
        expect(createCard).not.toHaveBeenCalled();
        expect(updateCard).not.toHaveBeenCalled();
    });

    it("returns service failures as MCP tool errors", async () => {
        vi.spyOn(PersonService, "loadPersons").mockRejectedValue(
            new Error("Database unavailable"),
        );

        const result = (await client.callTool({
            name: "list_persons",
            arguments: {},
        })) as ToolResult;

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toBe("Database unavailable");
    });
});
