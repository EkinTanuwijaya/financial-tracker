export enum TransactionSource {
  TEXT = "TEXT",
  RECEIPT = "RECEIPT",
  MANUAL = "MANUAL",
}

export enum ReceiptStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  WAITING_CONFIRMATION = "WAITING_CONFIRMATION",
}

export enum CategoryType {
  EXPENSE = "EXPENSE",
  INCOME = "INCOME",
}

export enum AIProvider {
  GEMINI = "gemini",
  OPENAI = "openai",
  CLAUDE = "claude",
}
