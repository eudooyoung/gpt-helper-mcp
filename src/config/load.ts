import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { configSchema, type Config } from "./schema.js";

export const loadConfig = async (path: string): Promise<Config> => {
  const content = await readFile(path, "utf-8");
  const parsed = parse(content);
  return configSchema.parse(parsed);
};
