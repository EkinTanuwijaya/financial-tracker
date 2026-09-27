import { z } from "zod";

export const createUserSchema = z.object({
  telegramId: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  passwordHash: z.string().optional(),
});

export const createWalletSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  currency: z.string().default("IDR"),
  balance: z.number().default(0),
});

export const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["EXPENSE", "INCOME"]),
});

export const createTransactionSchema = z.object({
  walletId: z.string().uuid(),
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default("IDR"),
  description: z.string().optional(),
  transactionDate: z.string().datetime(),
  source: z.enum(["TEXT", "RECEIPT", "MANUAL"]).default("MANUAL"),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const createReceiptSchema = z.object({
  fileUrl: z.string().url(),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
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
