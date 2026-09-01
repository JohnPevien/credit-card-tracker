import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const EXPECTED_TOOLS = [
    "list_transactions",
    "get_transaction",
    "set_transaction_paid",
    "list_purchases",
    "get_purchase",
    "create_purchase",
    "update_purchase",
    "delete_purchase",
    "list_persons",
    "create_person",
    "update_person",
    "delete_person",
    "list_credit_cards",
    "create_credit_card",
    "update_credit_card",
    "delete_credit_card",
] as const;

async function main() {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: ["--import", "tsx", "src/mcp/server.ts"],
        env: process.env as Record<string, string>,
        stderr: "pipe",
    });

    // Capture stderr for debugging
    const stderrStream = transport.stderr;
    if (stderrStream) {
        stderrStream.on("data", (chunk: Buffer) => {
            process.stderr.write(chunk);
        });
    }
    transport.onerror = (err) => {
        console.error("Transport error:", err);
    };

    const client = new Client({ name: "smoke-test", version: "0.1.0" });

    try {
        await client.connect(transport);

        const toolsResult = await client.listTools();
        const toolNames = (toolsResult.tools ?? []).map((t) => t.name).sort();
        const expectedSorted = [...EXPECTED_TOOLS].sort();

        console.log(`Tools registered: ${toolNames.length}`);
        console.log(`Tools: ${toolNames.join(", ")}`);

        if (toolNames.length !== EXPECTED_TOOLS.length) {
            console.error(
                `Expected ${EXPECTED_TOOLS.length} tools, got ${toolNames.length}`,
            );
            console.error(`Expected: ${expectedSorted.join(", ")}`);
            console.error(`Got: ${toolNames.join(", ")}`);
            process.exit(1);
        }

        const missing = expectedSorted.filter((n) => !toolNames.includes(n));
        const extra = toolNames.filter(
            (n) => !(expectedSorted as readonly string[]).includes(n),
        );

        if (missing.length > 0 || extra.length > 0) {
            if (missing.length > 0)
                console.error(`Missing tools: ${missing.join(", ")}`);
            if (extra.length > 0)
                console.error(`Extra tools: ${extra.join(", ")}`);
            process.exit(1);
        }

        console.log("✓ Tool registration OK (16 tools)");

        // Data call: list_persons — requires .env with valid Supabase creds
        const result = await client.callTool({
            name: "list_persons",
            arguments: {},
        });

        // Result shape is CallToolResult with content array; check isError
        const isError = (result as { isError?: boolean }).isError;

        if (isError) {
            console.warn(
                "list_persons returned a handled error; tool registration is still valid",
            );
            console.log("✓ Smoke passed (tool registration verified)");
        } else {
            const content = result as {
                content?: Array<{ type?: string; text?: string }>;
            };
            const text = content.content?.find(
                (item) => item.type === "text",
            )?.text;
            if (!text) {
                console.error("list_persons returned no text content");
                process.exit(1);
            }

            const data: unknown = JSON.parse(text);
            if (!Array.isArray(data)) {
                console.error("list_persons did not return an array");
                process.exit(1);
            }
            console.log(`✓ list_persons returned ${data.length} records`);
            console.log("✓ Smoke passed");
        }
    } catch (err) {
        console.error("Smoke test failed:", err);
        process.exit(1);
    } finally {
        try {
            await client.close();
        } catch {
            // ignore
        }
        // Give transport time to close, then force exit
        setTimeout(() => process.exit(0), 500);
    }
}

main();
