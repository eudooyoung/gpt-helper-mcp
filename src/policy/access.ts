import { basename, matchesGlob, relative, resolve } from "node:path";
import type { Config } from "../config/schema.js";
import { resolveProjectPath } from "../path/resolve.js";
import { DEFAULT_DENY_PATTERNS } from "./denylist.js";

export type Operation = "read" | "write";

export const assertAccess = (
  config: Config,
  requestedPath: string,
  operation: Operation,
): string => {
  const { root } = config.project;
  const { writableDirectories, writableFiles, denyPatterns } = config.access;
  const target = resolveProjectPath(root, requestedPath);

  for (const pattern of DEFAULT_DENY_PATTERNS) {
    if (basename(target) === pattern) {
      throw new Error("Access denied");
    }
  }

  for (const pattern of denyPatterns) {
    if (matchesGlob(relative(root, target), pattern)) {
      throw new Error("Access denied");
    }
  }

  if (operation === "read") {
    return target;
  }

  for (const dir of writableDirectories) {
    const allowed = resolve(root, dir);
    if (!relative(allowed, target).startsWith("../")) {
      return target;
    }
  }

  for (const file of writableFiles) {
    const allowed = resolveProjectPath(root, file);
    if (target === allowed) {
      return target;
    }
  }

  throw new Error("Write access denied");
};
