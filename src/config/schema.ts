import { z } from "zod";

export const configSchema = z.object({
  project: z.object({
    root: z.string(),
  }),
  access: z.object({
    writableDirectories: z.array(z.string()),
    writableFiles: z.array(z.string()),
    denyPatterns: z.array(z.string()),
  }),
});

export type Config = z.infer<typeof configSchema>;
