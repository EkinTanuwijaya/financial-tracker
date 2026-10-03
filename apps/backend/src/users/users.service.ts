import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

// Telegram user IDs are positive integers. The current range is well under
// 13 digits, so anything outside this is a typo rather than a real ID.
const TELEGRAM_ID_PATTERN = /^\d{5,15}$/;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * The only user fields allowed to leave the backend. Enforced here rather
   * than in the controllers so that a new endpoint cannot leak `passwordHash`
   * simply by forgetting to strip it.
   */
  private static readonly PUBLIC_SELECT = {
    id: true,
    email: true,
    name: true,
    telegramId: true,
  } as const;

  async findByTelegramId(telegramId: string) {
    return this.prisma.user.findUnique({
      where: { telegramId },
      select: UsersService.PUBLIC_SELECT,
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: UsersService.PUBLIC_SELECT,
    });
  }

  async emailExists(email: string): Promise<boolean> {
    const found = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return found !== null;
  }

  /**
   * The one method that returns `passwordHash`, for `bcrypt.compare` during
   * login only. It must never be the return value of a controller, and it is
   * named to make an accidental call site obvious.
   */
  async findCredentialsByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
  }

  /**
   * Creates a user. Callers pass an already-hashed password; the raw password
   * must never reach this layer, so hashing belongs in `AuthService`.
   */
  async create(data: {
    email?: string;
    name?: string;
    passwordHash?: string;
    telegramId?: string;
  }) {
    return this.prisma.user.create({
      data,
      select: UsersService.PUBLIC_SELECT,
    });
  }

  async update(id: string, data: Partial<{ name: string; email: string }>) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: UsersService.PUBLIC_SELECT,
    });
  }

  // Kept separate from update() so a profile update cannot be used to hijack a
  // Telegram link, and so telegramId is only ever written by link/unlink.
  async setTelegramId(userId: string, telegramId: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { telegramId },
      select: UsersService.PUBLIC_SELECT,
    });
  }

  async linkTelegram(userId: string, rawTelegramId: string) {
    const telegramId = String(rawTelegramId ?? "").trim();

    if (!TELEGRAM_ID_PATTERN.test(telegramId)) {
      throw new BadRequestException(
        "That does not look like a Telegram ID. It should be the number the " +
          "bot replies with, for example 123456789.",
      );
    }

    const owner = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });

    if (owner && owner.id !== userId) {
      throw new ConflictException(
        "That Telegram account is already linked to another user.",
      );
    }

    return this.setTelegramId(userId, telegramId);
  }

  async unlinkTelegram(userId: string) {
    return this.setTelegramId(userId, null);
  }
}
