import { ProfileDto, TelegramLinkDto } from "../common/request.dto";
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Patch,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";

/**
 * Every route here is JWT-guarded and scoped to the caller. The previous
 * `POST /api/users`, `GET /api/users/:id`, `GET /api/users/telegram/:telegramId`
 * and `PATCH /api/users/:id` were unauthenticated and returned raw Prisma rows,
 * so `GET /api/users/:id` exposed `passwordHash` to anyone.
 *
 * There is no create-user route here on purpose: registration hashes the
 * password in `AuthService`, so the only public way to create an account is
 * `POST /api/auth/register`. There is no lookup-by-telegram route either, since
 * it was an identity oracle mapping a Telegram ID to an email address.
 *
 * `UsersService` also selects public fields only, so a future route cannot
 * reintroduce the leak by forgetting to strip the hash.
 */
@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get the current user" })
  async me(@Request() req: { user: { id: string } }) {
    return this.usersService.findById(req.user.id);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update the current user's profile" })
  async updateMe(
    @Request() req: { user: { id: string } },
    @Body() body: ProfileDto,
  ) {
    // Scoped to req.user.id, so a user id in the body cannot be used to edit
    // someone else. telegramId is not accepted here: link/unlink own it.
    return this.usersService.update(req.user.id, body);
  }

  // Declared before :telegramId so the literal path always wins the match.
  @Post("telegram/link")
  @ApiOperation({ summary: "Link the current user to a Telegram account" })
  async linkTelegram(
    @Request() req: { user: { id: string } },
    @Body() body: TelegramLinkDto,
  ) {
    return this.usersService.linkTelegram(req.user.id, body.code);
  }

  @Delete("telegram/link")
  @ApiOperation({ summary: "Unlink the current user from Telegram" })
  async unlinkTelegram(@Request() req: { user: { id: string } }) {
    return this.usersService.unlinkTelegram(req.user.id);
  }
}
