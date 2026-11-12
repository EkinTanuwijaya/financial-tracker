import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { CategoriesModule } from "../categories/categories.module";
import { ReceiptsModule } from "../receipts/receipts.module";
import { TransactionsModule } from "../transactions/transactions.module";
import { UsersModule } from "../users/users.module";
import { WalletsModule } from "../wallets/wallets.module";
import { TelegramController } from "./telegram.controller";
import { TelegramService } from "./telegram.service";

@Module({
  imports: [AiModule, CategoriesModule, ReceiptsModule, TransactionsModule, UsersModule, WalletsModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
