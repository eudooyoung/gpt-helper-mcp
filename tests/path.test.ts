import { describe, expect, it } from "vitest";
import { resolveTargetPath } from "../src/path/resolve.js";

describe("resolveTargetPath", () => {
  describe("valid requested path", () => {
    const requestedPaths = [
      { case: "inbound path", path: "docs/PLAN.md", resolved: "/tmp/my-project/docs/PLAN.md" },
      {
        case: "inbound path with traversal",
        path: "docs/../README.md",
        resolved: "/tmp/my-project/README.md",
      },
      { case: "current directory path", path: ".", resolved: "/tmp/my-project" },
    ];

    it.each(requestedPaths)("resolves $case: $path", ({ path, resolved }) => {
      const root = "/tmp/my-project";

      const result = resolveTargetPath(root, path);

      expect(result).toBe(resolved);
    });
  });

  describe("invalid requested path", () => {
    const requestedPaths = [
      { case: "absolute outbound path", path: "/tmp/other-project/README.md" },
      { case: "absolute inbound path", path: "/tmp/my-project/README.md" },
      { case: "relative outbound path", path: "../outside.txt" },
    ];

    it.each(requestedPaths)("rejects $case: $path", ({ path }) => {
      const root = "/tmp/my-project";

      expect(() => resolveTargetPath(root, path)).toThrow();
    });
  });
});
