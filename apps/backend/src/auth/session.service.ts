import {
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import Redis from "ioredis";
import type { Request, Response } from "express";

export const SESSION_IDLE_SECONDS = 2 * 60 * 60;
const COOKIE_NAME = "finance_session";

export function sessionToken(request: Request): string | null {
  return (
    request.headers.cookie?.match(/(?:^|;\s*)finance_session=([^;]*)/)?.[1] ||
    null
  );
}

@Injectable()
export class SessionService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(
      config.get<string>("REDIS_URL") || "redis://localhost:6379",
      {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        commandTimeout: 5000,
      },
    );
  }

  async create(userId: string) {
    const id = randomUUID();
    await this.redis.set(`session:${id}`, userId, "EX", SESSION_IDLE_SECONDS);
    return id;
  }

  async validate(id: string, userId: string) {
    if (!id || (await this.redis.get(`session:${id}`)) !== userId) {
      throw new UnauthorizedException("Session expired. Please sign in again.");
    }
  }

  async renew(id: string) {
    if (
      !(await this.redis.expire(`session:${id}`, SESSION_IDLE_SECONDS, "XX"))
    ) {
      throw new UnauthorizedException("Session expired. Please sign in again.");
    }
  }

  async revoke(id: string) {
    await this.redis.del(`session:${id}`);
  }

  setCookie(response: Response, token: string) {
    response.cookie(COOKIE_NAME, token, {
      ...this.cookieOptions(),
      maxAge: SESSION_IDLE_SECONDS * 1000,
    });
    response.setHeader("Cache-Control", "no-store");
  }

  clearCookie(response: Response) {
    response.clearCookie(COOKIE_NAME, this.cookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: this.config.get("NODE_ENV") === "production",
      path: "/api",
    };
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
