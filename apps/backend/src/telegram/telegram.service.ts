import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import { UsersService } from "../users/users.service";
import { WalletsService } from "../wallets/wallets.service";
import { HELP_TEXT, renderWalletsMessage } from "./telegram.format";

const TELEGRAM_API = "https://api.telegram.org";
const POLL_TIMEOUT_SECONDS = 25;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: { id: number; username?: string; first_name?: string };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;
  private readonly loginAttempts = new Map<
    number,
    { count: number; firstAt: number }
  >();
  private stopped = false;
  private pollLoop: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly wallets: WalletsService,
    private readonly auth: AuthService,
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
    if (!message?.text) return;

    // Only answer in private chats so the bot stays quiet in groups.
    if (message.chat.type !== "private") return;

    const [rawCommand, ...args] = message.text.trim().split(/\s+/);
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
      case "/login":
        await this.sendLogin(message, args);
        return;
      case "/logout":
        await this.sendLogout(message);
        return;
      case "/wallets":
      case "/balance":
        await this.sendWallets(message);
        return;
      default:
        await this.sendMessage(
          message.chat.id,
          `Unknown command. Send /help to see what I can do.`,
        );
    }
  }

  private async sendWhoami(message: TelegramMessage): Promise<void> {
    const user = await this.findLinkedUser(message);
    if (!user) return;

    await this.sendMessage(
      message.chat.id,
      [
        `Logged in as ${user.email}.`,
        "",
        "Use /logout to unlink this Telegram account.",
      ].join("\n"),
    );
  }

  private async sendLogin(
    message: TelegramMessage,
    args: string[],
  ): Promise<void> {
    const telegramId = message.from?.id;
    if (telegramId === undefined) return;

    const [email, ...rest] = args;
    const password = rest.join(" ");

    if (!email || !password) {
      await this.sendMessage(
        message.chat.id,
        "Usage: /login <email> <password>",
      );
      return;
    }

    if (!this.allowLoginAttempt(message.chat.id)) {
      await this.sendMessage(
        message.chat.id,
        `Too many attempts. Try again in ${Math.ceil(
          LOGIN_WINDOW_MS / 60000,
        )} minutes.`,
      );
      return;
    }

    let account: Awaited<ReturnType<AuthService["verifyCredentials"]>>;
    try {
      account = await this.auth.verifyCredentials({ email, password });
    } catch {
      await this.sendMessage(message.chat.id, "Invalid credentials.");
      return;
    }

    if (account.telegramId && account.telegramId !== String(telegramId)) {
      await this.sendMessage(
        message.chat.id,
        "That account is already linked to a different Telegram user.",
      );
      return;
    }

    await this.users.setTelegramId(account.id, String(telegramId));
    this.loginAttempts.delete(message.chat.id);

    // Best effort: keep the password out of the chat history.
    const deleted = await this.deleteMessage(
      message.chat.id,
      message.message_id,
    );

    await this.sendMessage(
      message.chat.id,
      [
        `Logged in as ${account.email}.`,
        "",
        deleted
          ? "I deleted the message containing your password."
          : "I could not delete the message containing your password, so " +
            "please delete it yourself.",
        "Use /wallets to see your balances.",
      ].join("\n"),
    );
  }

  private async sendLogout(message: TelegramMessage): Promise<void> {
    const user = await this.findLinkedUser(message);
    if (!user) return;

    await this.users.setTelegramId(user.id, null);
    await this.sendMessage(
      message.chat.id,
      `Logged out. ${user.email} is no longer linked to this Telegram account.`,
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
          "Your Telegram account is not linked yet.",
          "",
          "Send /login <email> <password> to connect it.",
        ].join("\n"),
      );
      return null;
    }

    return user;
  }

  private allowLoginAttempt(chatId: number): boolean {
    const now = Date.now();
    const entry = this.loginAttempts.get(chatId);

    if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
      this.loginAttempts.set(chatId, { count: 1, firstAt: now });
      return true;
    }

    entry.count += 1;
    return entry.count <= LOGIN_ATTEMPT_LIMIT;
  }

  private async sendWallets(message: TelegramMessage): Promise<void> {
    const user = await this.findLinkedUser(message);
    if (!user) return;

    const wallets = await this.wallets.findAll(user.id);
    await this.sendMessage(
      message.chat.id,
      renderWalletsMessage(
        wallets.map((wallet) => ({
          name: wallet.name,
          type: wallet.type,
          balance: Number(wallet.balance),
        })),
      ),
    );
  }

  private async getUpdates(offset: number): Promise<TelegramUpdate[]> {
    return this.call<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: POLL_TIMEOUT_SECONDS,
      allowed_updates: ["message"],
    });
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    await this.call("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
  }

  private async deleteMessage(
    chatId: number,
    messageId: number,
  ): Promise<boolean> {
    try {
      await this.call("deleteMessage", {
        chat_id: chatId,
        message_id: messageId,
      });
      return true;
    } catch (error) {
      // Best effort only - the bot may not be allowed to delete messages.
      this.logger.warn(
        `Could not delete message ${messageId}: ${this.describe(error)}`,
      );
      return false;
    }
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
    return error instanceof Error ? error.message : String(error);
  }
}
