import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { DEFAULT_CATEGORIES } from "../categories/default-categories";
import { Prisma } from "@prisma/client";
import { TelegramLinkService } from "./telegram-link.service";

// A bot-issued pairing code proves access to the Telegram account being linked.

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private telegramLinks: TelegramLinkService,
  ) {}

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
    const found = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    return found !== null;
  }

  async findOrCreateGoogleUser(data: {
    googleId: string;
    email: string;
    name?: string;
  }) {
    return this.prisma
      .$transaction(async (tx) => {
        const linked = await tx.user.findUnique({
          where: { googleId: data.googleId },
          select: UsersService.PUBLIC_SELECT,
        });
        if (linked) return linked;

        const existing = await tx.user.findFirst({
          where: { email: { equals: data.email, mode: "insensitive" } },
          select: { id: true, googleId: true },
        });
        if (existing) {
          // Password accounts do not verify email, so email alone cannot authorize linking.
          throw new ConflictException(
            "This email already has an account. Sign in with your existing method.",
          );
        }

        return tx.user.upsert({
          where: { googleId: data.googleId },
          update: {},
          create: {
            googleId: data.googleId,
            email: data.email,
            name: data.name,
            categories: { create: DEFAULT_CATEGORIES },
          },
          select: UsersService.PUBLIC_SELECT,
        });
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ConflictException(
            "Account was updated by another sign-in. Please try again.",
          );
        }
        throw error;
      });
  }

  /**
   * The one method that returns `passwordHash`, for `bcrypt.compare` during
   * login only. It must never be the return value of a controller, and it is
   * named to make an accidental call site obvious.
   */
  async findCredentialsByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
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
      data: {
        ...data,
        categories: { create: DEFAULT_CATEGORIES },
      },
      select: UsersService.PUBLIC_SELECT,
    });
  }

  async update(id: string, data: Partial<{ name: string; email: string }>) {
    return this.prisma.user.update({
      where: { id },
      data: { name: data.name, email: data.email },
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

  async linkTelegram(userId: string, code: string) {
    const telegramId = await this.telegramLinks.consume(code);

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
