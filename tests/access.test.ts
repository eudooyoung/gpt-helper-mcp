import { describe, expect, it, vi } from "vitest";
import type { Config } from "../src/config/schema.js";
import { assertAccess } from "../src/policy/access.js";

vi.mock(import("../src/policy/denylist.js"), () => ({
  DEFAULT_DENY_PATTERNS: ["**/secrets/"],
}));

describe("assertAccess", () => {
  const projectRoot = "/tmp/my-project";

  describe("read access", () => {
    describe("allowed paths", () => {
      const targetPaths = [
        { case: "project root", targetPath: ".", resolvedPath: projectRoot },
        {
          case: "project child path",
          targetPath: "src/main.ts",
          resolvedPath: `${projectRoot}/src/main.ts`,
        },
      ];

      it.each(targetPaths)(
        "returns resolved target path when it is $case",
        ({ targetPath, resolvedPath }) => {
          const config: Config = {
            project: {
              root: projectRoot,
            },
            access: {
              writableDirectories: [],
              writableFiles: [],
              denyPatterns: [],
            },
          };

          const result = assertAccess(config, targetPath, "read");

          expect(result).toBe(resolvedPath);
        },
      );
    });

    describe("denylist", () => {
      it("rejects path matching default denylist", () => {
        const config: Config = {
          project: {
            root: projectRoot,
          },
          access: {
            writableDirectories: [],
            writableFiles: [],
            denyPatterns: [],
          },
        };
        const targetPath = "src/secrets/info.txt";

        expect(() => assertAccess(config, targetPath, "read")).toThrow(
          Error("Access denied to denylist"),
        );
      });

      it("rejects path matching custom denylist", () => {
        const config: Config = {
          project: {
            root: projectRoot,
          },
          access: {
            writableDirectories: [],
            writableFiles: [],
            denyPatterns: ["**/private/"],
          },
        };
        const targetPath = "src/private/notes.md";

        expect(() => assertAccess(config, targetPath, "read")).toThrow(
          Error("Access denied to denylist"),
        );
      });
    });
  });
});
