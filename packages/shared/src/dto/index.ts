import { z } from "zod";

export const createUserSchema = z.object({
  telegramId: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  passwordHash: z.string().optional(),
});

export const createWalletSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["CASH", "BANK", "EWALLET", "CREDIT_CARD", "OTHER"]),
  currency: z.literal("IDR").default("IDR"),
  balance: z.number().default(0),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["EXPENSE", "INCOME"]),
});

export const createTransactionSchema = z.object({
  walletId: z.string().cuid(),
  categoryId: z.string().cuid(),
  amount: z.number().min(0.01).max(Number.MAX_SAFE_INTEGER),
  currency: z.literal("IDR").default("IDR"),
  description: z.string().optional(),
  transactionDate: z.iso.date().or(z.iso.datetime({ offset: true })),
  source: z.enum(["TEXT", "RECEIPT", "MANUAL"]).default("MANUAL"),
});

export const updateTransactionSchema = createTransactionSchema
  .partial()
  .extend({
    currency: z.literal("IDR").optional(),
    source: z.enum(["TEXT", "RECEIPT", "MANUAL"]).optional(),
  });

export const createReceiptSchema = z.object({
  fileUrl: z.string().url(),
});

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8)
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "Password must be at most 72 UTF-8 bytes",
    ),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateWalletInput = z.infer<typeof createWalletSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
