import { describe, expect, it } from "vitest";
import type { Config } from "../src/config/schema.js";
import { assertAccess } from "../src/policy/access.js";

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
      const patterns = [
        { case: "default denylist", denyPatterns: [], targetPath: ".env" },
        { case: "custom denylist", denyPatterns: ["**/private/"], targetPath: "private/note.txt" },
      ];

      it.each(patterns)("rejects path matching $case", ({ denyPatterns, targetPath }) => {
        const config: Config = {
          project: {
            root: projectRoot,
          },
          access: {
            writableDirectories: [],
            writableFiles: [],
            denyPatterns,
          },
        };

        expect(() => assertAccess(config, targetPath, "read")).toThrow(
          new Error("Access denied to denylist"),
        );
      });

      it("doesn't apply denylist to project root", () => {
        const config: Config = {
          project: {
            root: projectRoot,
          },
          access: {
            writableDirectories: [],
            writableFiles: [],
            denyPatterns: ["/"],
          },
        };
        const targetPath = ".";

        const result = assertAccess(config, targetPath, "read");

        expect(result).toBe(projectRoot);
      });
    });
  });
});
