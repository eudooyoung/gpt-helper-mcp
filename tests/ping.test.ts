import { describe, expect, it } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../src/server.js";

describe("ping in-memory test", () => {
  it("returns pong", async () => {
    const server = createServer();
    const client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const result = await client.callTool({ name: "ping" });

      expect(result.content).toEqual([{ type: "text", text: "pong" }]);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
