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
    const body = JSON.parse(opts.body);
    console.log("TELEGRAM SEND:", body.text?.split("\n")[0] || body.text?.slice(0, 80));
    return { json: async () => ({ ok: true, result: { message_id: 1 } }) };
  }
  return originalFetch(url, opts);
};

const drive = async (svc, text) => {
  captured = [];
  await svc.handleUpdate({
    update_id: Math.floor(Math.random() * 100000),
    message: { message_id: 1, text, chat: { id: 3333, type: "private" }, from: { id: 3333 } },
  });
  return captured.filter((c) => c.method === "sendMessage").map((c) => c.body.text);
};

(async () => {
  const prisma = new PrismaService();
  const user = await prisma.user.create({ data: { email: `tgclass${Date.now()}@example.com`, telegramId: "3333" } });
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

  // Test classification directly
  console.log("\n--- Test classifyMessage ---");
  const testCases = [
    "lunch 50k bca",
    "gaji 5jt masuk",
    "who are you",
    "why taking so long",
    "hello",
    "help",
    "beli kopi 25rb tunai",
  ];
  for (const tc of testCases) {
    const cls = await ai.classifyMessage(tc);
    console.log(`"${tc}" -> isTransaction: ${cls.isTransaction}, confidence: ${cls.confidence}, reason: ${cls.reason}`);
  }

  const svc = new TelegramService(
    { get: () => "1:FAKE" }, users, wallets, categories, transactions, ai
  );

  // Test non-transaction messages
  console.log("\n--- Test: who are you ---");
  const out1 = await drive(svc, "who are you");
  console.log(out1[0] || "(no reply)");

  console.log("\n--- Test: why taking so long ---");
  const out2 = await drive(svc, "why taking so long");
  console.log(out2[0] || "(no reply)");

  // Test valid transaction
  console.log("\n--- Test: lunch 50k bca ---");
  const out3 = await drive(svc, "lunch 50k bca");
  console.log(out3[0] || "(no reply)");

  // Cleanup
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });
  await prisma.wallet.deleteMany({ where: { userId: user.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  console.log("\ncleanup done");
  process.exit(0);
})().catch((e) => { console.log("FAILED:", e && e.stack); process.exit(1); });