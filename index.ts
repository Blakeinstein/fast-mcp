import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadToolsFromConfigs } from "./create_tools.js";

async function initializeServer() {
  const server = new McpServer(
    {
      name: "fast-mcp",
      version: "0.2.0",
    },
    {
      capabilities: {
        tools: {},
        logging: {},
      },
    }
  );

  // Load tools from YAML configs
  await loadToolsFromConfigs(server);

  // Keep the original hello tool as an example
  server.tool(
    "hello_tool",
    "Hello tool",
    {
      name: z.string().describe("The name of the person to greet"),
    },
    async ({ name }) => {
      console.error("Hello tool", { name });
      return {
        content: [
          {
            type: "text",
            text: `Hello, ${name}!`,
          },
        ],
      };
    }
  );

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Fast MCP Server running on stdio");
  }

  return runServer();
}

initializeServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
