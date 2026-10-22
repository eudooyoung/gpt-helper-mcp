import { matchesGlob, relative } from "node:path";
import type { Config } from "../config/schema.js";
import { resolveTargetPath } from "../path/resolve.js";
import { DEFAULT_DENY_PATTERNS } from "./denylist.js";

export type Operation = "read" | "write";

export const assertAccess = (config: Config, targetPath: string, operation: Operation): string => {
  const { root } = config.project;
  const resolvedTargetPath = resolveTargetPath(root, targetPath);
  const relativeTargetPath = relative(root, resolvedTargetPath);
  const dirs = relativeTargetPath.split("/");

  let currentDir = "";
  const { denyPatterns } = config.access;

  for (const dir of dirs) {
    currentDir += `${dir}/`;
    for (const pattern of DEFAULT_DENY_PATTERNS) {
      if (matchesGlob(currentDir, pattern)) {
        throw Error("Access denied to denylist");
      }
    }

    for (const pattern of denyPatterns) {
      if (matchesGlob(currentDir, pattern)) {
        throw Error("Access denied to denylist");
      }
    }
  }

  return resolvedTargetPath;
};
