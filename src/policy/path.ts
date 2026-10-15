import { isAbsolute, relative, resolve } from "node:path";

export const resolveProjectPath = (root: string, requestedPath: string): string => {
  const path = resolve(root, requestedPath);
  const relativePath = relative(root, path);
  const isInvalidPath =
    relativePath === ".." || relativePath.startsWith("../") || isAbsolute(relativePath);
  if (isInvalidPath) {
    throw new Error();
  }
  return path;
};
