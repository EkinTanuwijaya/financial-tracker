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
    console.log("TELEGRAM SEND:", JSON.parse(opts.body).text.split("\n")[0]);
    return { json: async () => ({ ok: true, result: { message_id: 1 } }) };
  }
  return originalFetch(url, opts);
};

const drive = async (svc, text) => {
  captured = [];
  await svc.handleUpdate({
    update_id: Math.floor(Math.random() * 100000),
    message: { message_id: 1, text, chat: { id: 2222, type: "private" }, from: { id: 2222 } },
  });
  return captured.filter((c) => c.method === "sendMessage").map((c) => c.body.text);
};

(async () => {
  const prisma = new PrismaService();
  const user = await prisma.user.create({ data: { email: `tgai${Date.now()}@example.com`, telegramId: "2222" } });
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

  // Step 1: Natural language
  console.log("\n--- Step 1: lunch 50k bca ---");
  const out1 = await drive(svc, "lunch 50k bca");
  console.log(out1[0] || "(no reply)");

  // Step 2: Confirm with "yes"
  console.log("\n--- Step 2: yes ---");
  const out2 = await drive(svc, "yes");
  console.log(out2[0] || "(no reply)");

  // Verify transaction was created
  const txns = await prisma.transaction.findMany({ where: { userId: user.id } });
  console.log("\nTransactions in DB:", txns.length);
  if (txns.length > 0) {
    console.log("  Amount:", txns[0].amount);
    console.log("  Description:", txns[0].description);
    console.log("  Category:", txns[0].categoryId);
    console.log("  Wallet:", txns[0].walletId);
  }

  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });
  await prisma.wallet.deleteMany({ where: { userId: user.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  console.log("\ncleanup done");
  process.exit(0);
})().catch((e) => { console.log("FAILED:", e && e.stack); process.exit(1); });