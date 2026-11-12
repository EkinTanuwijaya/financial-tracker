require("reflect-metadata");
const { PrismaService } = require("/app/apps/backend/dist/common/prisma/prisma.service");
const { UsersService } = require("/app/apps/backend/dist/users/users.service");
const { WalletsService } = require("/app/apps/backend/dist/wallets/wallets.service");
const { CategoriesService } = require("/app/apps/backend/dist/categories/categories.service");
const { TransactionsService } = require("/app/apps/backend/dist/transactions/transactions.service");
const { TelegramService } = require("/app/apps/backend/dist/telegram/telegram.service");

let captured = [];
global.fetch = async (url, opts) => {
  const m = url.split("/").pop();
  if (m === "getUpdates") return { json: async () => ({ ok: true, result: [] }) };
  return { json: async () => ({ ok: true, result: { message_id: 1 } }) };
};
const drive = async (svc, text) => {
  captured = [];
  await svc.handleUpdate({
    update_id: Math.floor(Math.random() * 100000),
    message: { message_id: 1, text, chat: { id: 6666, type: "private" }, from: { id: 6666 } },
  });
  return captured.filter((c) => c.method === "sendMessage").map((c) => c.body.text);
};

(async () => {
  const prisma = new PrismaService();
  const user = await prisma.user.create({ data: { email: `tgai${Date.now()}@example.com`, telegramId: "6666" } });
  const w = await prisma.wallet.create({ data: { userId: user.id, name: "BCA", type: "BANK", balance: 1000000 } });
  const cat = await prisma.category.create({ data: { userId: user.id, name: "Makanan", type: "EXPENSE" } });

  const users = new UsersService(prisma);
  const wallets = new WalletsService(prisma);
  const categories = new CategoriesService(prisma);
  const transactions = new TransactionsService(prisma);

  // This uses the REAL AiService from the container with actual env vars
  const svc = new TelegramService(
    { get: () => "1:FAKE" }, users, wallets, categories, transactions,
    // AiService will be injected by Nest with real config
  );

  // Manually inject AiService since we're not using Nest DI here
  const { AiService } = require("/app/apps/backend/dist/ai/ai.service");
  const ai = new AiService({
    get: (key) => process.env[key],
  });
  svc.ai = ai;

  console.log("AI available:", ai.isAvailable());
  if (ai.isAvailable()) {
    console.log("healthCheck:", await ai.healthCheck());
  }

  const out = await drive(svc, "lunch 50k bca");
  console.log("\nBot response:");
  console.log(out[0] || "(no reply)");

  await prisma.category.deleteMany({ where: { userId: user.id } });
  await prisma.wallet.deleteMany({ where: { userId: user.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  console.log("\ncleanup done");
  process.exit(0);
})().catch((e) => { console.log("FAILED:", e && e.stack); process.exit(1); });