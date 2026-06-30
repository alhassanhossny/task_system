import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyId: z.string().uuid().optional()
});

export type LoginFormValues = z.infer<typeof loginSchema>;
