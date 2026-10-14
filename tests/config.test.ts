import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/load.js";

describe("loadConfig", () => {
  it("reads valid YAML config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "helper-mcp-test"));
    const path = join(dir, "config.yaml");
    try {
      await writeFile(
        path,
        `
        project:
          root: /tmp/test-project
  
        access:
          writableDirectories: 
            - docs/
          writableFiles: 
            - README.md
          denyPatterns: []
        `,
      );

      const content = await loadConfig(path);
      expect(content).toEqual({
        project: { root: "/tmp/test-project" },
        access: {
          writableDirectories: ["docs/"],
          writableFiles: ["README.md"],
          denyPatterns: [],
        },
      });
    } finally {
      rm(dir, { recursive: true, force: true });
    }
  });
});
