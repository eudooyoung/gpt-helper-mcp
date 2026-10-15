import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { loadConfig } from "../src/config/load.js";

describe("loadConfig", () => {
  const createTempConfig = async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-test"));
    const path = join(dir, "config.yaml");
    return { dir, path };
  };

  describe("succeeds reading config", () => {
    it("reads valid yaml config", async () => {
      const { dir, path } = await createTempConfig();
      try {
        await writeFile(
          path,
          `
        project:
          root: /tmp/my-project
        access:
          writableDirectories: 
            - docs/
          writableFiles: 
            - /tmp/my-project/README.md
          denyPatterns:
            - "**/secrets/**"
        `,
        );

        const content = await loadConfig(path);
        expect(content).toEqual({
          project: { root: "/tmp/my-project" },
          access: {
            writableDirectories: ["docs/"],
            writableFiles: ["/tmp/my-project/README.md"],
            denyPatterns: ["**/secrets/**"],
          },
        });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it("uses default access values", async () => {
      const { dir, path } = await createTempConfig();
      try {
        await writeFile(
          path,
          `
          project:
            root: /tmp/my-project
          access: {}
          `,
        );

        const content = await loadConfig(path);
        expect(content).toEqual({
          project: { root: "/tmp/my-project" },
          access: {
            writableDirectories: [],
            writableFiles: [],
            denyPatterns: [],
          },
        });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe("fails reading config", () => {
    describe("type validation", () => {
      const invalidTypeConfigs = [
        {
          name: "rejects non-string project root",
          yaml: `
          project:
            root: 123
          access: {}
          `,
        },
        {
          name: "rejects non-array writableDirectories",
          yaml: `
          project:
            root: "/tmp/my-project"
          access:
            writableDirectories: docs/
          `,
        },
        {
          name: "rejects non-string array items",
          yaml: `
          project:
            root: "/tmp/my-project"
          access:
            writableFiles: 
            - 123
          `,
        },
      ];

      it.each(invalidTypeConfigs)("$name", async ({ yaml }) => {
        const { dir, path } = await createTempConfig();
        try {
          await writeFile(path, yaml);
          await expect(loadConfig(path)).rejects.toThrow(ZodError);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      });
    });

    describe("path validation", () => {
      const invalidPathConfigs = [
        {
          name: "rejects relative project root",
          yaml: `
          project:
            root: ./my-project
          access: {}
          `,
        },
        {
          name: "rejects parent directory traversing writable directory",
          yaml: `
          project:
            root: "/tmp/my-project"
          access:
            writableDirectories:
            - ../outside
          `,
        },
        {
          name: "rejects absolute writable directory traversal outside",
          yaml: `
          project:
            root: "/tmp/my-project"
          access:
            writableDirectories:
            - /temp/other-project
          `,
        },
        {
          name: "rejects empty string writable directory",
          yaml: `
          project:
            root: "/tmp/my-project"
          access:
            writableDirectories:
            - ""
          `,
        },
      ];

      it.each(invalidPathConfigs)("$name", async ({ yaml }) => {
        const { dir, path } = await createTempConfig();
        try {
          await writeFile(path, yaml);
          await expect(loadConfig(path)).rejects.toThrow(ZodError);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      });
    });
  });
});
