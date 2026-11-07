import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { WalletsModule } from "./wallets/wallets.module";
import { CategoriesModule } from "./categories/categories.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { ReceiptsModule } from "./receipts/receipts.module";
import { AuthModule } from "./auth/auth.module";
import { TelegramModule } from "./telegram/telegram.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env", "../../.env"],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    CategoriesModule,
    TransactionsModule,
    ReceiptsModule,
    TelegramModule,
  ],
})
export class AppModule {}
