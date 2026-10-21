import { isAbsolute, relative, resolve } from "node:path";

export const resolveTargetPath = (root: string, requestedPath: string): string => {
  if (isAbsolute(requestedPath)) {
    throw new Error("Target path input is absolute");
  }
  const path = resolve(root, requestedPath);
  const relativePath = relative(root, path);
  const isPathOutbound = relativePath === ".." || relativePath.startsWith("../");
  if (isPathOutbound) {
    throw new Error("Target path escapes project directory");
  }
  return path;
};
