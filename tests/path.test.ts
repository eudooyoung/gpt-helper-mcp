import { describe, expect, it } from "vitest";
import { resolveProjectPath } from "../src/path/resolve.js";

describe("resolveProjectPath", () => {
  describe("valid requested path", () => {
    const requestedPaths = [{ path: "docs/PLAN.md" }, { path: "/tmp/my-project/docs/PLAN.md" }];

    it.each(requestedPaths)("resolves valid requested path: $path", ({ path }) => {
      const root = "/tmp/my-project";

      const result = resolveProjectPath(root, path);

      expect(result).toBe("/tmp/my-project/docs/PLAN.md");
    });
  });

  describe("invalid requested path", () => {
    const requestedPaths = [{ path: "../outside.txt" }, { path: "/tmp/another-project/README.md" }];

    it.each(requestedPaths)("rejects invalid requested path: $path", ({ path }) => {
      const root = "/tmp/my-project";

      expect(() => resolveProjectPath(root, path)).toThrow();
    });
  });
});
