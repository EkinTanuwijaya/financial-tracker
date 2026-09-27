export interface User {
  id: string;
  telegramId?: string | null;
  email?: string | null;
  name?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: "EXPENSE" | "INCOME";
  createdAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  walletId: string;
  categoryId: string;
  amount: number;
  currency: string;
  description?: string | null;
  transactionDate: Date;
  source: "TEXT" | "RECEIPT" | "MANUAL";
  createdAt: Date;
  updatedAt: Date;
  wallet?: Wallet;
  category?: Category;
}

export interface Receipt {
  id: string;
  userId: string;
  transactionId?: string | null;
  fileUrl: string;
  processingStatus:
    "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "WAITING_CONFIRMATION";
  rawText?: string | null;
  extractedData?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReceiptExtractionResult {
  merchant: string | null;
  date: string | null;
  total: number | null;
  currency: string | null;
  items: ReceiptItem[];
  category: string | null;
  confidence: number;
}

export interface ReceiptItem {
  name: string;
  quantity: number | null;
  price: number | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
