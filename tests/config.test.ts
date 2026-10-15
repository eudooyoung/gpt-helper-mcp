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

  describe("valid congifuration", () => {
    it("loads valid YAML with relative access paths", async () => {
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
            - README.md
          denyPatterns:
            - "**/secrets/**"
        `,
        );

        const content = await loadConfig(path);
        expect(content).toEqual({
          project: { root: "/tmp/my-project" },
          access: {
            writableDirectories: ["docs/"],
            writableFiles: ["README.md"],
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
        name: "rejects path escaping project root",
        yaml: `
          project:
            root: "/tmp/my-project"
          access:
            writableDirectories:
            - ../outside
          `,
      },
      {
        name: "rejects absolute writableDirectories",
        yaml: `
          project:
            root: "/tmp/my-project"
          access:
            writableDirectories:
            - /tmp/my-project/docs/
          `,
      },
      {
        name: "rejects absolute writableFiles",
        yaml: `
          project:
            root: "/tmp/my-project"
          access:
            writableFiles:
            - /tmp/my-project/docs/PLAN.md
          `,
      },
      {
        name: "rejects empty writableDirectories entry",
        yaml: `
          project:
            root: "/tmp/my-project"
          access:
            writableDirectories:
            - ""
          `,
      },
      {
        name: "rejects empty writableFiles entry",
        yaml: `
          project:
            root: "/tmp/my-project"
          access:
            writableFiles:
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
