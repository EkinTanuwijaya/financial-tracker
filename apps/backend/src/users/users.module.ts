import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { TelegramLinkService } from "./telegram-link.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService, TelegramLinkService],
  exports: [UsersService, TelegramLinkService],
})
export class UsersModule {}
