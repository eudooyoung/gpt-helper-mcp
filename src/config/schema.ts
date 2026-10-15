import { isAbsolute } from "node:path";
import { z } from "zod";
import { resolveProjectPath } from "../path/resolve.js";

export type Config = z.infer<typeof configSchema>;

export const configSchema = z
  .object({
    project: z.object({
      root: z.string().refine(isAbsolute),
    }),
    access: z.object({
      writableDirectories: z.array(z.string().min(1)).default([]),
      writableFiles: z.array(z.string().min(1)).default([]),
      denyPatterns: z.array(z.string()).default([]),
    }),
  })
  .superRefine((config, ctx) => {
    const root = config.project.root;
    const fields = ["writableDirectories", "writableFiles"] as const;

    for (const field of fields) {
      const paths = config.access[field];

      for (const [index, path] of paths.entries()) {
        try {
          resolveProjectPath(root, path);
        } catch (error) {
          ctx.addIssue({
            code: "custom",
            path: ["access", field, index],
            message: (error as Error).message,
          });
        }
      }
    }
  });
