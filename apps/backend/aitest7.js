require("reflect-metadata");
const { PrismaService } = require("/app/apps/backend/dist/common/prisma/prisma.service");
const { UsersService } = require("/app/apps/backend/dist/users/users.service");
const { WalletsService } = require("/app/apps/backend/dist/wallets/wallets.service");
const { CategoriesService } = require("/app/apps/backend/dist/categories/categories.service");
const { TransactionsService } = require("/app/apps/backend/dist/transactions/transactions.service");
const { TelegramService } = require("/app/apps/backend/dist/telegram/telegram.service");
const { AiService } = require("/app/apps/backend/dist/ai/ai.service");

let captured = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (url.includes("api.telegram.org")) {
    const m = url.split("/").pop();
    if (m === "getUpdates") return { json: async () => ({ ok: true, result: [] }) };
    console.log("TELEGRAM SEND:", JSON.parse(opts.body));
    return { json: async () => ({ ok: true, result: { message_id: 1 } }) };
  }
  return originalFetch(url, opts);
};

const drive = async (svc, text) => {
  captured = [];
  await svc.handleUpdate({
    update_id: Math.floor(Math.random() * 100000),
    message: { message_id: 1, text, chat: { id: 1111, type: "private" }, from: { id: 1111 } },
  });
  return captured.filter((c) => c.method === "sendMessage").map((c) => c.body.text);
};

(async () => {
  const prisma = new PrismaService();
  const user = await prisma.user.create({ data: { email: `tgai${Date.now()}@example.com`, telegramId: "1111" } });
  const w = await prisma.wallet.create({ data: { userId: user.id, name: "BCA", type: "BANK", balance: 1000000 } });
  const cat = await prisma.category.create({ data: { userId: user.id, name: "Makanan", type: "EXPENSE" } });

  const users = new UsersService(prisma);
  const wallets = new WalletsService(prisma);
  const categories = new CategoriesService(prisma);
  const transactions = new TransactionsService(prisma);

  const ai = new AiService({
    get: (key) => process.env[key],
  });
  ai.onModuleInit();

  console.log("AI available:", ai.isAvailable());

  const svc = new TelegramService(
    { get: () => "1:FAKE" }, users, wallets, categories, transactions, ai
  );

  const out = await drive(svc, "lunch 50k bca");
  console.log("\nBot response:");
  console.log(out[0] || "(no reply)");

  await prisma.category.deleteMany({ where: { userId: user.id } });
  await prisma.wallet.deleteMany({ where: { userId: user.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  console.log("\ncleanup done");
  process.exit(0);
})().catch((e) => { console.log("FAILED:", e && e.stack); process.exit(1); });