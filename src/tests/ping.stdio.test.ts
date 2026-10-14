import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

describe("ping stdio test", () => {
  it("returns pong", async () => {
    const client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/main.js"],
    });

    try {
      await client.connect(transport);

      const result = await client.callTool({ name: "ping" });

      expect(result.content).toEqual([{ type: "text", text: "pong" }]);
    } finally {
      await client.close();
    }
  });
});
