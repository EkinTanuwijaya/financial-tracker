import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiProvider, AiConfig } from "./ai.interface";
import { createProvider } from "./openai-compatible.provider";

/** The exact shape we want the LLM to return for a transaction. */
export const TRANSACTION_SCHEMA = {
  type: "object",
  properties: {
    amount: { type: "number", description: "Amount in IDR, e.g. 50000" },
    currency: { type: "string", const: "IDR" },
    wallet: {
      type: "string",
      description: "Wallet name as the user would say it",
    },
    category: {
      type: "string",
      description: "Category name as the user would say it",
    },
    description: {
      type: "string",
      description: "Free-text description, optional",
    },
    date: {
      type: "string",
      description:
        "ISO date (YYYY-MM-DD) or relative like today/yesterday. If omitted, defaults to today.",
    },
    type: {
      type: "string",
      enum: ["EXPENSE", "INCOME"],
      description: "Defaults to EXPENSE",
    },
  },
  required: ["amount", "wallet", "category"],
  additionalProperties: false,
} as const;

export const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    isTransaction: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" },
  },
  required: ["isTransaction", "confidence"],
  additionalProperties: false,
} as const;

export type TransactionExtraction = {
  amount: number;
  currency: "IDR";
  wallet: string;
  category: string;
  description?: string;
  date?: string;
  type?: "EXPENSE" | "INCOME";
};

export type MessageClassification = {
  isTransaction: boolean;
  confidence: number;
  reason?: string;
};

@Injectable()
export class AiService implements OnModuleInit {
  private provider: AiProvider | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const provider = this.config.get<string>("AI_PROVIDER");
    const apiKey = this.config.get<string>("AI_API_KEY");
    const baseUrl = this.config.get<string>("AI_BASE_URL");
    const model = this.config.get<string>("AI_MODEL");

    if (!provider || !apiKey || !model) {
      return;
    }

    this.provider = createProvider({
      provider,
      apiKey,
      baseUrl,
      model,
      timeoutMs: this.config.get<number>("AI_TIMEOUT_MS") ?? 30_000,
    });
  }

  isAvailable(): boolean {
    return this.provider !== null;
  }

  async extractTransaction(
    text: string,
    context?: { wallets: string[]; categories: string[] },
    caption?: string,
  ): Promise<TransactionExtraction | null> {
    if (!this.provider) return null;

    const userWallets = context?.wallets ?? [];
    const categoryList = context?.categories?.length
      ? `\nYour categories: ${context.categories.join(", ")}`
      : "";

    const today = new Date().toISOString().slice(0, 10);

    // Define alias mappings
    const aliasMap: Record<string, string[]> = {
      CIMB: ["octo", "octo mobile", "cimb clicks"],
      Mandiri: ["livin", "livin' by mandiri", "livin by mandiri"],
      BCA: ["bca mobile", "bca", "mybca", "m-bca"],
      BRI: ["brimo", "bri"],
      BNI: ["bni mobile", "bni"],
      Jenius: ["jenius"],
      Permata: ["permata", "permatamobile"],
      Maybank: ["maybank"],
      Danamon: ["danamon"],
    };

    // Only include aliases for wallets the user actually has
    const activeAliases: string[] = [];
    for (const [wallet, aliases] of Object.entries(aliasMap)) {
      if (userWallets.some((w) => w.toLowerCase() === wallet.toLowerCase())) {
        activeAliases.push(`  * ${aliases.map((a) => `"${a}"`).join(" / ")} → "${wallet}"`);
      }
    }
    const aliasText = activeAliases.length ? `\n- Wallet aliases:\n${activeAliases.join("\n")}` : "";

    const captionText = caption ? `\nUser note (caption): "${caption}"` : "";

    const prompt = `Extract a financial transaction from this OCR text. The user writes in Indonesian or English.

OCR Text: "${text}"${captionText}
Your wallets: ${userWallets.join(", ")}${categoryList}${aliasText}

Rules:
- Amount must be in IDR (no currency conversion).
- CRITICAL: Indonesian number format uses DOT as thousands separator, COMMA as decimal.
  * "16.000,00" or "16.000" = 16000 (sixteen thousand)
  * "1.600.000,00" or "1.600.000" = 1600000 (one million six hundred thousand)
  * "100.000" = 100000 (one hundred thousand)
  * "50.000,50" = 50000.50
  * Always remove dots, replace comma with dot for decimal, parse as number
- Wallet and category MUST be chosen from the lists above. Use the exact names.
- CRITICAL: For transfer receipts, identify the SENDER's bank (your wallet), NOT the receiver's bank.
  * Sender bank = the banking APP NAME at the top (e.g., "Octo Mobile", "Livin", "BCA Mobile", "BRImo", "Jenius")
  * Receiver bank = shown in "Ke" / "Kepada" / "Beneficiary" / "Tujuan" section → IGNORE this
  * Use wallet aliases below to map app name → your wallet name
- Description: use the user note (caption) if provided. Otherwise, only include merchant/note/memo text from receipt. DO NOT include:
  * Receiver bank name or account number
  * "Transfer to", "Ke", "Kepada", "Tujuan", "Beneficiary"
  * Any account numbers (masked or full)
  * If no meaningful description, leave empty
- If the user says "masuk", "income", "gaji", "pemasukan" → type is INCOME. Otherwise EXPENSE.
- Date formats in receipts may be Indonesian: DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY (e.g., "28 Mar 2025", "28/03/2025", "28-03-2025"). Convert to ISO YYYY-MM-DD.
- Indonesian month names: Jan/Feb/Mar/Apr/Mei/Jun/Jul/Ags/Sep/Okt/Nov/Des
- If NO date is found in the OCR text, return date as null (do NOT default to today).
- Today is ${today} (only use if receipt explicitly says "today" or "hari ini").`;

    return this.provider.complete<TransactionExtraction>(prompt, TRANSACTION_SCHEMA);
  }

  async healthCheck(): Promise<boolean> {
    return this.provider?.healthCheck?.() ?? false;
  }

  async classifyMessage(text: string): Promise<MessageClassification> {
    if (!this.provider) {
      return { isTransaction: false, confidence: 0, reason: "AI not available" };
    }

    const prompt = `Classify if this message is a financial transaction request.

Message: "${text}"

Rules:
- A transaction request MUST contain an amount (number with optional k/rb/jt/m suffix) AND a wallet/category reference.
- Questions like "who are you", "why taking so long", "help", greetings, chit-chat → NOT a transaction.
- Commands like "/start", "/help", "/balance" → NOT a transaction (handled separately).
- "lunch 50k bca", "gaji 5jt masuk", "beli kopi 25rb tunai" → IS a transaction.
- Respond with JSON only.`;

    const result = await this.provider.complete<MessageClassification>(prompt, CLASSIFICATION_SCHEMA);
    return result ?? { isTransaction: false, confidence: 0, reason: "Classification failed" };
  }
}
