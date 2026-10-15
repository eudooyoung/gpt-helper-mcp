import { describe, expect, it } from "vitest";
import type { Config } from "../src/config/schema.js";
import { assertAccess } from "../src/policy/access.js";

describe("assertAccess", () => {
  describe("read access", () => {
    it("returns target path for read operation", () => {
      const config: Config = {
        project: {
          root: "/tmp/my-project",
        },
        access: {
          writableDirectories: ["docs/"],
          writableFiles: [],
          denyPatterns: [],
        },
      };
      const requestedPath = "src/main.ts";
      const operation = "read";

      const result = assertAccess(config, requestedPath, operation);

      expect(result).toBe("/tmp/my-project/src/main.ts");
    });
  });

  describe("write acces", () => {
    it("return target path within writable directory", () => {
      const config: Config = {
        project: {
          root: "/tmp/my-project",
        },
        access: {
          writableDirectories: ["docs/"],
          writableFiles: [],
          denyPatterns: [],
        },
      };
      const requestedPath = "docs/PLAN.md";
      const operation = "write";

      const result = assertAccess(config, requestedPath, operation);

      expect(result).toBe("/tmp/my-project/docs/PLAN.md");
    });

    it("rejects write outside writable directory", () => {
      const config: Config = {
        project: {
          root: "/tmp/my-project",
        },
        access: {
          writableDirectories: ["docs/"],
          writableFiles: [],
          denyPatterns: [],
        },
      };
      const requestedPath = "src/main.ts";
      const operation = "write";
    });

    it("returns target path for explicitly writable file", () => {
      const config: Config = {
        project: {
          root: "/tmp/my-project",
        },
        access: {
          writableDirectories: [],
          writableFiles: ["README.md"],
          denyPatterns: [],
        },
      };
      const requestedPath = "README.md";
      const operation = "write";

      const result = assertAccess(config, requestedPath, operation);

      expect(result).toBe("/tmp/my-project/README.md");
    });

    it("rejects write outside writable paths", () => {
      const config: Config = {
        project: {
          root: "/tmp/my-project",
        },
        access: {
          writableDirectories: [],
          writableFiles: ["README.md"],
          denyPatterns: [],
        },
      };
      const requestedPath = "src/main.ts";
      const operation = "write";

      expect(() => assertAccess(config, requestedPath, operation)).toThrow();
    });

    it("rejects write on project root", () => {
      const config: Config = {
        project: {
          root: "/tmp/my-project",
        },
        access: {
          writableDirectories: ["docs/"],
          writableFiles: [],
          denyPatterns: [],
        },
      };
      const requestedPath = "/tmp/my-project";
      const operation = "write";

      expect(() => assertAccess(config, requestedPath, operation)).toThrow();
    });
  });

  describe("default denylist", () => {
    it("rejects read of sensitive file by default", () => {
      const config: Config = {
        project: {
          root: "/tmp/my-project",
        },
        access: {
          writableDirectories: [],
          writableFiles: [],
          denyPatterns: [],
        },
      };
      const requestedPath = ".env";
      const operation = "read";

      expect(() => assertAccess(config, requestedPath, operation)).toThrow();
    });

    it("rejects read of nested sensitive file by default", () => {
      const config: Config = {
        project: {
          root: "/tmp/my-project",
        },
        access: {
          writableDirectories: [],
          writableFiles: [],
          denyPatterns: [],
        },
      };
      const requestedPath = "src/.env";
      const operation = "read";

      expect(() => assertAccess(config, requestedPath, operation)).toThrow();
    });
  });

  describe("custom denylist", () => {
    it("rejects read matching custom deny pattern", () => {
      const config: Config = {
        project: {
          root: "/tmp/my-project",
        },
        access: {
          writableDirectories: [],
          writableFiles: [],
          denyPatterns: ["**/private/**"],
        },
      };
      const requestedPath = "src/private/notes.md";
      const operation = "read";

      expect(() => assertAccess(config, requestedPath, operation)).toThrow();
    });
  });
});
