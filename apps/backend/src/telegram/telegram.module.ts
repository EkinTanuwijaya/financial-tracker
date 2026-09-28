import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { WalletsModule } from "../wallets/wallets.module";
import { TelegramService } from "./telegram.service";

@Module({
  imports: [AuthModule, UsersModule, WalletsModule],
  providers: [TelegramService],
})
export class TelegramModule {}
