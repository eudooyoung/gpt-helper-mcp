import { isAbsolute } from "node:path";
import { z } from "zod";

export type Config = z.infer<typeof configSchema>;
const relativePathSchema = z
  .string()
  .refine((path) => !isAbsolute(path))
  .refine((path) => {
    const pathTokens = path.split("/");
    return !pathTokens.includes("..");
  });

export const configSchema = z.object({
  project: z.object({
    root: z.string().refine(isAbsolute),
  }),
  access: z.object({
    writableDirectories: z.array(relativePathSchema).default([]),
    writableFiles: z.array(relativePathSchema).default([]),
    denyPatterns: z.array(z.string()).default([]),
  }),
});
