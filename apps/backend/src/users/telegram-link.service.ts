import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import Redis from "ioredis";

@Injectable()
export class TelegramLinkService implements OnModuleDestroy {
  private readonly redis: Redis;
  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>("REDIS_URL") || "redis://localhost:6379",
      { maxRetriesPerRequest: 1, connectTimeout: 5000, commandTimeout: 5000 },
    );
  }
  async issue(telegramId: string) {
    const code = randomBytes(16).toString("hex");
    await this.redis.set(`telegram-link:${code}`, telegramId, "EX", 600);
    return code;
  }
  async consume(rawCode: string) {
    const code = String(rawCode ?? "").trim();
    if (!/^[a-f0-9]{32}$/.test(code))
      throw new BadRequestException(
        "Send /link to the Telegram bot and paste its pairing code here.",
      );
    const telegramId = await this.redis.getdel(`telegram-link:${code}`);
    if (!telegramId)
      throw new BadRequestException(
        "Pairing code is invalid or expired. Send /link to get a new code.",
      );
    return telegramId;
  }
  onModuleDestroy() {
    this.redis.disconnect();
  }
}
