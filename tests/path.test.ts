import { describe, expect, it } from "vitest";
import { resolveProjectPath } from "../src/policy/path.js";

describe("resolveProjectPath", () => {
  describe("valid requested path", () => {
    const requestedPaths = [{ path: "docs/PLAN.md" }, { path: "/tmp/test-project/docs/PLAN.md" }];

    it.each(requestedPaths)("resolves valid requested path: $path", ({ path }) => {
      const root = "/tmp/test-project";

      const result = resolveProjectPath(root, path);

      expect(result).toBe("/tmp/test-project/docs/PLAN.md");
    });
  });

  describe("invalid requested path", () => {
    const requestedPaths = [{ path: "../outside.txt" }, { path: "/tmp/another-project/README.md" }];

    it.each(requestedPaths)("rejects invalid requested path: $path", ({ path }) => {
      const root = "/tmp/test-project";

      expect(() => resolveProjectPath(root, path)).toThrow();
    });
  });
});
