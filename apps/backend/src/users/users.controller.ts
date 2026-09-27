import { Controller, Get, Param, Post, Body, Patch } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: "Create a new user" })
  async create(
    @Body()
    body: {
      telegramId?: string;
      email?: string;
      name?: string;
      passwordHash?: string;
    },
  ) {
    return this.usersService.create(body);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  async findById(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Get("telegram/:telegramId")
  @ApiOperation({ summary: "Get user by Telegram ID" })
  async findByTelegramId(@Param("telegramId") telegramId: string) {
    return this.usersService.findByTelegramId(telegramId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update user" })
  async update(
    @Param("id") id: string,
    @Body() body: { name?: string; email?: string },
  ) {
    return this.usersService.update(id, body);
  }
}
