import { McpServer } from "@modelcontextprotocol/server";

export const createServer = () => {
  const server = new McpServer({
    name: "gpt-helper-mcp",
    version: "1.0.0",
  });

  server.registerTool("ping", {}, async () => {
    return { content: [{ type: "text", text: "pong" }] };
  });

  return server;
};
