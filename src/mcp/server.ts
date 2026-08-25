import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "@/mcp/tools";

const server = createMcpServer();
const transport = new StdioServerTransport();

server.connect(transport).catch((error: unknown) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
});
