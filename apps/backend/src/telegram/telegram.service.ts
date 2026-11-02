import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CategoriesService } from "../categories/categories.service";
import { TransactionsService } from "../transactions/transactions.service";
import { UsersService } from "../users/users.service";
import { WalletsService } from "../wallets/wallets.service";
import { ReceiptsService } from "../receipts/receipts.service";
import { AiService, TransactionExtraction } from "../ai/ai.service";
import { generateReportPdf } from "../reports/report-pdf";
import {
  REPORT_USAGE,
  getReportRange,
  parseReportPeriod,
} from "../reports/report-period";
import {
  CATEGORY_ADD_USAGE,
  CATEGORY_USAGE,
  HELP_TEXT,
  DATE_USAGE,
  WALLET_ADD_USAGE,
  parseCategoryAdd,
  parseUserDate,
  parseWalletAdd,
  renderBalanceMessage,
  renderCategoryBreakdown,
  renderCategoryCreated,
  renderCategoryList,
  renderNameTaken,
  renderTransactionsMessage,
  renderWalletCreated,
  renderWalletList,
} from "./telegram.format";

const TELEGRAM_API = "https://api.telegram.org";
const POLL_TIMEOUT_SECONDS = 25;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function idr(amount: number): string {
  const grouped = Math.round(Math.abs(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = amount < 0 ? "-" : "";
  return `${sign}Rp ${grouped}`;
}

function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits).replace(/\.0+$/, "")}%`;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: { id: number; username?: string; first_name?: string };
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>;
  document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number };
  caption?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;
  private stopped = false;
  private pollLoop: Promise<void> | null = null;
  private botInfo: {
    username: string | null;
    firstName: string | null;
  } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly wallets: WalletsService,
    private readonly categories: CategoriesService,
    private readonly transactions: TransactionsService,
    private readonly receipts: ReceiptsService,
    private readonly ai: AiService,
  ) {
    this.token = (this.config.get<string>("TELEGRAM_BOT_TOKEN") ?? "")
      .trim()
      .replace(/^["']|["']$/g, "");
  }

  onModuleInit(): void {
    if (!this.token) {
      this.logger.warn(
        "TELEGRAM_BOT_TOKEN is not set, Telegram bot is disabled.",
      );
      return;
    }
    this.pollLoop = this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.pollLoop?.catch(() => undefined);
  }

  private async run(): Promise<void> {
    let offset = 0;
    let backoff = INITIAL_BACKOFF_MS;

    while (!this.stopped) {
      try {
        const updates = await this.getUpdates(offset);
        backoff = INITIAL_BACKOFF_MS;

        for (const update of updates) {
          offset = update.update_id + 1;
          try {
            await this.handleUpdate(update);
          } catch (error) {
            this.logger.error(
              `Failed to handle update ${update.update_id}: ${this.describe(error)}`,
            );
          }
        }
      } catch (error) {
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        this.logger.warn(
          `Polling failed (${this.describe(error)}), retrying in ${backoff}ms`,
        );
        await this.sleep(backoff);
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message) return;

    // Only answer in private chats so the bot stays quiet in groups.
    if (message.chat.type !== "private") return;

    const chatId = message.chat.id;

    // Handle photo/document (receipt)
    if (message.photo?.length || message.document) {
      await this.handleReceipt(message);
      return;
    }

    if (!message.text) return;

    const text = message.text.trim();

    // Handle pending confirmations first.
    const pending = this.pendingConfirmations.get(chatId);
    if (pending) {
      const lower = text.toLowerCase();
      if (
        lower === "yes" ||
        lower === "ya" ||
        lower === "y" ||
        lower === "ok"
      ) {
        await this.transactions.create(pending.userId, {
          walletId: pending.walletId,
          categoryId: pending.categoryId,
          amount: pending.amount,
          description: pending.description,
          transactionDate: pending.date,
        });
        this.pendingConfirmations.delete(chatId);
        await this.sendMessage(chatId, "Saved. ✅");
        return;
      } else {
        this.pendingConfirmations.delete(chatId);
        await this.sendMessage(chatId, "Cancelled.");
        return;
      }
    }

    const [rawCommand, ...args] = text.split(/\s+/);
    // Strip the @botname suffix Telegram appends in group chats.
    const command = rawCommand.split("@")[0].toLowerCase();

    switch (command) {
      case "/start":
        await this.sendMessage(
          message.chat.id,
          `Hi${message.from?.first_name ? ` ${message.from.first_name}` : ""}!\n\n${HELP_TEXT}`,
        );
        return;
      case "/help":
        await this.sendMessage(message.chat.id, HELP_TEXT);
        return;
      case "/whoami":
        await this.sendWhoami(message);
        return;
      case "/wallets":
        await this.sendWallets(message);
        return;
      case "/wallet":
        await this.sendWalletCommand(message, args);
        return;
      case "/balance":
        await this.sendBalance(message);
        return;
      case "/transaction":
        await this.sendTransactions(message, args.join(" "));
        return;
      case "/category":
      case "/categories":
        await this.sendCategories(message, args);
        return;
      case "/report":
      case "/export":
        await this.sendReport(message, args.join(" "));
        return;
      default:
        // Not a known command: classify first, then try AI extraction if it looks like a transaction
        if (this.ai.isAvailable()) {
          const thinkingMsgId = await this.sendThinkingMessage(message.chat.id);
          let classification;
          try {
            classification = await this.ai.classifyMessage(message.text.trim());
          } catch (error) {
            this.logger.error("Classification failed:", error);
            classification = { isTransaction: false, confidence: 0, reason: "Classification error" };
          }

          if (thinkingMsgId) {
            try {
              await this.call("deleteMessage", {
                chat_id: message.chat.id,
                message_id: thinkingMsgId,
              });
            } catch {
              // Ignore
            }
          }

          if (classification.isTransaction && classification.confidence > 0.7) {
            await this.handleNaturalLanguage(message, message.text.trim());
          } else {
            await this.sendMessage(
              message.chat.id,
              `I didn't understand that as a transaction. Try:\n"lunch 50k bca"\n"gaji 5jt masuk"\n\nOr send /help for commands.`,
            );
          }
        } else {
          await this.sendMessage(
            message.chat.id,
            `Unknown command. Send /help to see what I can do.`,
          );
        }
    }
  }

  private async sendWhoami(message: TelegramMessage): Promise<void> {
    const user = await this.findLinkedUser(message);
    if (!user) return;

    await this.sendMessage(
      message.chat.id,
      `Linked to ${user.email}. Unlink from the dashboard if you want to switch accounts.`,
    );
  }

  private async findLinkedUser(
    message: TelegramMessage,
  ): Promise<{ id: string; email: string | null; name: string | null } | null> {
    const telegramId = message.from?.id;
    if (telegramId === undefined) return null;

    const user = await this.users.findByTelegramId(String(telegramId));
    if (!user) {
      await this.sendMessage(
        message.chat.id,
        [
          "This Telegram account is not linked to a Finance Tracker account yet.",
          "",
          `Your Telegram ID: ${telegramId}`,
          "",
          "Open the dashboard, paste that number into the Telegram banner,",
          "and link it. Then send /wallets again.",
        ].join("\n"),
      );
      return null;
    }

    return user;
  }

  private async sendWallets(message: TelegramMessage): Promise<void> {
    const user = await this.findLinkedUser(message);
    if (!user) return;

    const wallets = await this.wallets.findAll(user.id);
    await this.sendMessage(
      message.chat.id,
      renderWalletList(
        wallets.map((wallet) => ({
          name: wallet.name,
          type: wallet.type,
          balance: Number(wallet.balance),
        })),
      ),
    );
  }

  private async sendBalance(message: TelegramMessage): Promise<void> {
    const user = await this.findLinkedUser(message);
    if (!user) return;

    const wallets = await this.wallets.findAll(user.id);
    await this.sendMessage(
      message.chat.id,
      renderBalanceMessage(
        wallets.map((wallet) => ({
          name: wallet.name,
          type: wallet.type,
          balance: Number(wallet.balance),
        })),
      ),
    );
  }

  private async sendTransactions(
    message: TelegramMessage,
    dateArg: string,
  ): Promise<void> {
    if (!dateArg) {
      await this.sendMessage(message.chat.id, DATE_USAGE);
      return;
    }

    const parsed = parseUserDate(dateArg);
    if (!parsed) {
      await this.sendMessage(
        message.chat.id,
        [`I could not read "${dateArg}" as a date.`, "", DATE_USAGE].join("\n"),
      );
      return;
    }

    const user = await this.findLinkedUser(message);
    if (!user) return;

    const transactions = await this.transactions.findAll(user.id, {
      startDate: parsed.start,
      endDate: parsed.end,
      // Higher than the display cap so In/Out/Net cover the whole period.
      limit: 500,
    });

    await this.sendMessage(
      message.chat.id,
      renderTransactionsMessage(
        parsed.label,
        transactions.map((transaction) => ({
          amount: Number(transaction.amount),
          description: transaction.description,
          categoryName: transaction.category.name,
          categoryType: transaction.category.type,
          walletName: transaction.wallet.name,
          date: transaction.transactionDate,
        })),
      ),
    );
  }

  private async sendReport(
    message: TelegramMessage,
    periodArg: string,
  ): Promise<void> {
    const user = await this.findLinkedUser(message);
    if (!user) return;

    const period = parseReportPeriod(periodArg);
    if (!period) {
      await this.sendMessage(
        message.chat.id,
        [`I could not read "${periodArg}" as a period.`, "", REPORT_USAGE].join(
          "\n",
        ),
      );
      return;
    }

    const range = getReportRange(period);

    try {
      await this.sendChatAction(message.chat.id, "upload_document");
      const summary = await this.transactions.getSummary(
        user.id,
        range.startDate,
        range.endDate,
      );
      const pdf = generateReportPdf(summary, {
        label: range.label,
        dateRangeLabel: range.dateRangeLabel,
      });
      await this.sendDocument(
        message.chat.id,
        pdf,
        `financial-report-${range.period}.pdf`,
        [
          `📊 Your financial report — ${range.label}`,
          `📅 Period: ${range.dateRangeLabel}`,
          "",
          `💰 Income: ${idr(summary.totalIncome)}`,
          `💸 Expense: ${idr(summary.totalExpense)}`,
          `📈 Net: ${idr(summary.totalIncome - summary.totalExpense)}`,
          `💡 Savings rate: ${summary.totalIncome > 0 ? formatPercent(((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 100) : "—"}`,
        ].join("\n"),
      );
    } catch (error) {
      this.logger.error(`Report failed: ${this.describe(error)}`);
      await this.sendMessage(
        message.chat.id,
        "Could not generate the report. Please try again.",
      );
    }
  }

  private async sendWalletCommand(
    message: TelegramMessage,
    args: string[],
  ): Promise<void> {
    const sub = (args[0] ?? "").toLowerCase();

    if (sub !== "add") {
      // No subcommand: show the wallets, matching /wallets.
      if (sub) {
        await this.sendMessage(
          message.chat.id,
          [`I do not know "/wallet ${sub}".`, "", WALLET_ADD_USAGE].join("\n"),
        );
        return;
      }
      await this.sendWallets(message);
      return;
    }

    const user = await this.findLinkedUser(message);
    if (!user) return;

    const parsed = parseWalletAdd(args.slice(1));
    if ("error" in parsed) {
      await this.sendMessage(
        message.chat.id,
        [parsed.error, "", WALLET_ADD_USAGE].join("\n"),
      );
      return;
    }

    const existing = await this.wallets.findByName(user.id, parsed.name);
    if (existing) {
      await this.sendMessage(
        message.chat.id,
        renderNameTaken("wallet", parsed.name),
      );
      return;
    }

    const wallet = await this.wallets.create(user.id, {
      name: parsed.name,
      type: parsed.type,
      balance: parsed.balance,
    });

    await this.sendMessage(
      message.chat.id,
      renderWalletCreated({
        name: wallet.name,
        type: wallet.type,
        balance: Number(wallet.balance),
      }),
    );
  }

  private async addCategory(
    message: TelegramMessage,
    args: string[],
  ): Promise<void> {
    const user = await this.findLinkedUser(message);
    if (!user) return;

    const parsed = parseCategoryAdd(args.slice(1));
    if ("error" in parsed) {
      await this.sendMessage(
        message.chat.id,
        [parsed.error, "", CATEGORY_ADD_USAGE].join("\n"),
      );
      return;
    }

    const existing = await this.categories.findByName(user.id, parsed.name);
    if (existing) {
      await this.sendMessage(
        message.chat.id,
        renderNameTaken("category", parsed.name),
      );
      return;
    }

    const category = await this.categories.create(user.id, {
      name: parsed.name,
      type: parsed.type,
    });

    await this.sendMessage(
      message.chat.id,
      renderCategoryCreated({ name: category.name, type: category.type }),
    );
  }

  private async sendCategories(
    message: TelegramMessage,
    args: string[],
  ): Promise<void> {
    const dateArg = args.join(" ").trim();

    if ((args[0] ?? "").toLowerCase() === "add") {
      await this.addCategory(message, args);
      return;
    }

    const user = await this.findLinkedUser(message);
    if (!user) return;

    if (!dateArg) {
      // No period: list the categories themselves, with lifetime usage so the
      // list says which ones are actually in use.
      const [categories, grouped] = await Promise.all([
        this.categories.findAll(user.id),
        this.transactions.sumByCategory(user.id),
      ]);

      const usage = new Map(grouped.map((row) => [row.categoryId, row]));

      await this.sendMessage(
        message.chat.id,
        renderCategoryList(
          categories.map((category) => {
            const row = usage.get(category.id);
            return {
              name: category.name,
              type: category.type,
              count: row?.count ?? 0,
              total: row?.total ?? 0,
            };
          }),
        ),
      );
      return;
    }

    const parsed = parseUserDate(dateArg);
    if (!parsed) {
      await this.sendMessage(
        message.chat.id,
        [`I could not read "${dateArg}" as a date.`, "", CATEGORY_USAGE].join(
          "\n",
        ),
      );
      return;
    }

    const grouped = await this.transactions.sumByCategory(user.id, {
      startDate: parsed.start,
      endDate: parsed.end,
    });

    await this.sendMessage(
      message.chat.id,
      renderCategoryBreakdown(
        parsed.label,
        grouped.map((row) => ({
          name: row.categoryName,
          type: row.categoryType,
          count: row.count,
          total: row.total,
        })),
      ),
    );
  }

  /**
   * Public bot identity, used by the dashboard banner so people can find the
   * bot without guessing. Bot usernames are public anyway. Results are cached;
   * a failure is not cached so it retries on the next call.
   */
  async getBotInfo(): Promise<{
    username: string | null;
    firstName: string | null;
  }> {
    if (this.botInfo) return this.botInfo;
    if (!this.token) return { username: null, firstName: null };

    try {
      const me = await this.call<{ username: string; first_name: string }>(
        "getMe",
        {},
      );
      this.botInfo = { username: me.username, firstName: me.first_name };
    } catch (error) {
      this.logger.warn(`Could not read bot info: ${this.describe(error)}`);
      return { username: null, firstName: null };
    }

    return this.botInfo;
  }

  private async getUpdates(offset: number): Promise<TelegramUpdate[]> {
    return this.call<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: POLL_TIMEOUT_SECONDS,
      allowed_updates: ["message"],
    });
  }

  private async handleReceipt(message: TelegramMessage): Promise<void> {
    const user = await this.findLinkedUser(message);
    if (!user) {
      await this.sendMessage(message.chat.id, "Please link your account first using /start");
      return;
    }

    this.pendingConfirmations.delete(message.chat.id);

    const fileId = message.photo?.[message.photo.length - 1]?.file_id ?? message.document?.file_id;
    if (!fileId) {
      await this.sendMessage(message.chat.id, "Could not get file from message.");
      return;
    }

    this.logger.log(`Processing receipt with file_id: ${fileId}`);

    const thinkingMsgId = await this.sendThinkingMessage(message.chat.id);

    try {
      const file = await this.getFile(fileId);
      if (!file) {
        await this.sendMessage(message.chat.id, "Failed to get file info from Telegram.");
        return;
      }

      this.logger.log(`Got file_path: ${file.file_path}`);

      const imageBuffer = await this.downloadFile(file);
      if (!imageBuffer) {
        await this.sendMessage(message.chat.id, "Failed to download file content.");
        return;
      }

      this.logger.log(`Downloaded ${imageBuffer.length} bytes`);

      const receipt = await this.receipts.create(user.id, { fileUrl: `telegram:${fileId}` });
      await this.receipts.processReceipt(receipt.id, imageBuffer, message.caption);

      const processed = await this.receipts.findById(receipt.id, user.id);

      if (thinkingMsgId) {
        try {
          await this.call("deleteMessage", {
            chat_id: message.chat.id,
            message_id: thinkingMsgId,
          });
        } catch {
          // Ignore
        }
      }

      if (processed?.processingStatus === "WAITING_CONFIRMATION" && processed.extractedData) {
        const extraction = processed.extractedData as {
          type: string;
          amount: number;
          category: string;
          wallet: string;
          description?: string;
          date?: string;
        };
        const isIncome = extraction.type === "INCOME";
        const sign = isIncome ? "+" : "-";

        const [wallet, category] = await Promise.all([
          extraction.wallet?.trim() ? this.wallets.findByName(user.id, extraction.wallet) : null,
          extraction.category?.trim() ? this.categories.findByName(user.id, extraction.category) : null,
        ]);
        if (!wallet || !category) {
          await this.sendMessage(
            message.chat.id,
            `Receipt amount: ${sign}Rp ${extraction.amount.toLocaleString("id-ID")}\n` +
              `Date: ${extraction.date ?? "(not detected)"}\n\n` +
              `Cannot save yet: ${[!wallet && "wallet not matched", !category && "category not matched"].filter(Boolean).join(", ")}.\n` +
              `Check /wallets and /category. Create missing entries with /wallet add <name> and /category add <name>.\n` +
              `Then resend the receipt with a caption naming the wallet and category.`,
          );
          return;
        }

        await this.sendMessage(
          message.chat.id,
          `Receipt processed! 📄\n\n` +
            `Please confirm:\n` +
            `${sign}Rp ${extraction.amount.toLocaleString("id-ID")} — ${extraction.category} (${extraction.wallet})` +
            (extraction.description ? `\n${extraction.description}` : "") +
            `\nDate: ${extraction.date ?? "(not detected — will use today)"}\n` +
            `Reply "yes" to save, anything else to cancel.`,
        );

        this.pendingConfirmations.set(message.chat.id, {
          userId: user.id,
          walletId: wallet.id,
          categoryId: category.id,
          amount: extraction.amount,
          description: extraction.description ?? "",
          date: extraction.date ? new Date(extraction.date) : new Date(),
          receiptId: receipt.id,
        });
      } else {
        const rawText = processed?.rawText ? `\n\nOCR text: ${processed.rawText.slice(0, 300)}` : "";
        const extracted = processed?.extractedData as { error?: string } | undefined;
        const errorInfo = extracted?.error ? `\nError: ${extracted.error}` : "";
        await this.sendMessage(
          message.chat.id,
          `Could not extract transaction data from receipt. Please try a clearer photo or enter manually.${errorInfo}${rawText}`,
        );
      }
    } catch (error) {
      this.logger.error("Receipt processing failed:", error);
      if (thinkingMsgId) {
        try {
          await this.call("deleteMessage", {
            chat_id: message.chat.id,
            message_id: thinkingMsgId,
          });
        } catch {
          // Ignore
        }
      }
      await this.sendMessage(message.chat.id, "Failed to process receipt. Please try again.");
    }
  }

  private async getFile(fileId: string): Promise<{ file_path: string } | null> {
    try {
      const url = `${TELEGRAM_API}/bot${this.token}/getFile`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        result?: { file_path: string };
        description?: string;
      };

      // Telegram sometimes returns file info even with ok=false
      const filePath = data.result?.file_path;
      if (filePath) {
        this.logger.debug(`Got file_path: ${filePath}`);
        return { file_path: filePath };
      }

      this.logger.error(`getFile failed: ${JSON.stringify(data)}`);
      return null;
    } catch (error) {
      this.logger.error(`getFile error: ${error}`);
      return null;
    }
  }

  private async downloadFile(file: { file_path: string }): Promise<Buffer | null> {
    try {
      const url = `${TELEGRAM_API}/file/bot${this.token}/${file.file_path}`;
      this.logger.debug(`Downloading file from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.error(`Download failed: ${response.status} ${response.statusText} for ${url}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(`downloadFile error: ${error}`);
      return null;
    }
  }

  private async handleNaturalLanguage(
    message: TelegramMessage,
    text: string,
  ): Promise<void> {
    const user = await this.findLinkedUser(message);
    if (!user) return;

    const thinkingMsgId = await this.sendThinkingMessage(message.chat.id);

    let extraction;
    let wallets: Array<{ id: string; name: string; type: string }> = [];
    let categories: Array<{ id: string; name: string; type: string }> = [];
    try {
      const [w, c] = await Promise.all([
        this.wallets.findAll(user.id),
        this.categories.findAll(user.id),
      ]);
      wallets = w;
      categories = c;

      extraction = await this.ai.extractTransaction(text, {
        wallets: wallets.map((w) => w.name),
        categories: categories.map((c) => c.name),
      });
    } catch (error) {
      this.logger.error("Transaction extraction failed:", error);
      extraction = null;
    }

    if (thinkingMsgId) {
      try {
        await this.call("deleteMessage", {
          chat_id: message.chat.id,
          message_id: thinkingMsgId,
        });
      } catch {
        // Ignore deletion errors
      }
    }

    if (!extraction) {
      await this.sendMessage(
        message.chat.id,
        `I couldn't understand that as a transaction. Try:\n"lunch 50k bca"\n"gaji 5jt masuk"`,
      );
      return;
    }

    const wallet = this.fuzzyMatch(extraction.wallet, wallets);
    const category = this.fuzzyMatch(extraction.category, categories);

    const missing: string[] = [];
    if (!wallet) missing.push(`wallet "${extraction.wallet}"`);
    if (!category) missing.push(`category "${extraction.category}"`);

    if (missing.length > 0) {
      await this.sendMessage(
        message.chat.id,
        `I found the transaction but couldn't match: ${missing.join(", ")}.\n` +
          `Available wallets: ${wallets.map((w) => w.name).join(", ")}\n` +
          `Available categories: ${categories.map((c) => c.name).join(", ")}`,
      );
      return;
    }

    // wallet and category are guaranteed non-null here due to the early return above.
    const w = wallet!;
    const c = category!;

    // Determine the category type to set the sign correctly.
    const catType =
      extraction.type ?? (c.type === "INCOME" ? "INCOME" : "EXPENSE");

    // Parse date or default to today.
    const date = extraction.date
      ? this.parseRelativeDate(extraction.date)
      : new Date();

    const isIncome = catType === "INCOME";
    const sign = isIncome ? "+" : "-";

    await this.sendMessage(
      message.chat.id,
      `Please confirm:\n` +
        `${sign}Rp ${extraction.amount.toLocaleString("id-ID")} — ${c.name} (${w.name})` +
        (extraction.description ? `\n${extraction.description}` : "") +
        `\nDate: ${date.toISOString().slice(0, 10)}\n` +
        `Reply "yes" to save, anything else to cancel.`,
    );

    // Store pending confirmation in a simple in-memory map keyed by chat ID.
    // In production this should be Redis with TTL, but for MVP this works.
    this.pendingConfirmations.set(message.chat.id, {
      userId: user.id,
      walletId: w.id,
      categoryId: c.id,
      amount: extraction.amount,
      description: extraction.description ?? undefined,
      date,
    });
  }

  private pendingConfirmations = new Map<
    number,
    {
      userId: string;
      walletId: string;
      categoryId: string;
      amount: number;
      description?: string;
      date: Date;
      receiptId?: string;
    }
  >();

  /**
   * Fuzzy match a user-provided name against known objects with id and name.
   * Case-insensitive, allows partial matches, prefers exact.
   */
  private fuzzyMatch<T extends { id: string; name: string }>(
    input: string,
    candidates: T[],
  ): T | null {
    const lower = input.toLowerCase().trim();
    const exact = candidates.find((c) => c.name.toLowerCase() === lower);
    if (exact) return exact;

    const partial = candidates.find(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        lower.includes(c.name.toLowerCase()),
    );
    if (partial) return partial;

    return null;
  }

  /**
   * Parses relative dates (today, yesterday) or ISO dates.
   */
  private parseRelativeDate(input: string): Date {
    const lower = input.toLowerCase().trim();
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    );

    if (lower === "today" || lower === "hari ini") return today;
    if (lower === "yesterday" || lower === "kemarin") {
      return new Date(today.getTime() - 24 * 60 * 60 * 1000);
    }

    // Try ISO
    const iso = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return new Date(
        Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
      );
    }

    return today;
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    await this.call("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
  }

  /**
   * Sends a file via sendDocument (multipart/form-data — the Bot API
   * does not accept file bytes as JSON).
   */
  private async sendDocument(
    chatId: number,
    file: Buffer,
    filename: string,
    caption?: string,
  ): Promise<void> {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append(
      "document",
      new Blob([file], { type: "application/pdf" }),
      filename,
    );
    if (caption) {
      form.append("caption", caption);
    }

    const response = await fetch(
      `${TELEGRAM_API}/bot${this.token}/sendDocument`,
      { method: "POST", body: form },
    );

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
    };

    if (!data.ok) {
      throw new Error(data.description ?? `HTTP ${response.status}`);
    }
  }

  private async sendChatAction(chatId: number, action: "typing" | "record_audio" | "upload_photo" | "upload_video" | "upload_document" | "find_location"): Promise<void> {
    await this.call("sendChatAction", {
      chat_id: chatId,
      action,
    });
  }

  private async sendThinkingMessage(chatId: number): Promise<number | null> {
    try {
      const result = await this.call<{ ok: boolean; result: { message_id: number } }>("sendMessage", {
        chat_id: chatId,
        text: "🤔 Thinking...",
        disable_web_page_preview: true,
      });
      return result.result?.message_id ?? null;
    } catch {
      return null;
    }
  }

  private async editMessage(chatId: number, messageId: number, text: string): Promise<void> {
    await this.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      disable_web_page_preview: true,
    });
  }

  private async call<T>(
    method: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${TELEGRAM_API}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };

    if (!data.ok) {
      throw new Error(data.description ?? `HTTP ${response.status}`);
    }

    return data.result as T;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private describe(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    // The bot token is part of every request URL, so an error that embeds one
    // would otherwise write the credential into the container logs.
    return this.token ? text.split(this.token).join("<redacted>") : text;
  }
}
