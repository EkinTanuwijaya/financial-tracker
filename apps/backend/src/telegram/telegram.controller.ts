import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { TelegramService } from "./telegram.service";

@ApiTags("telegram")
@Controller("telegram")
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Get("bot")
  @ApiOperation({ summary: "Public info about the Telegram bot" })
  async bot() {
    return this.telegram.getBotInfo();
  }
}
