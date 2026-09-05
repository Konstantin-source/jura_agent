import { z } from "zod";

export const loginSchema = z
  .object({
    email: z.email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

const setupUserSchema = z
  .object({
    email: z.email().max(254),
    displayName: z.string().trim().min(1).max(60),
    password: z.string().min(12).max(128),
  })
  .strict();

export const setupSchema = z
  .object({
    setupToken: z.string().min(1).max(512),
    users: z.tuple([setupUserSchema, setupUserSchema]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.users[0].email.trim().toLowerCase() === value.users[1].email.trim().toLowerCase()) {
      context.addIssue({
        code: "custom",
        path: ["users", 1, "email"],
        message: "Die beiden E-Mail-Adressen müssen unterschiedlich sein.",
      });
    }
  });
