const assert = require("node:assert/strict");
const { randomUUID, randomBytes, randomInt } = require("node:crypto");
const { PrismaClient, Prisma } = require("@prisma/client");
const Redis = require("ioredis");
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const base = process.env.TEST_API_URL || "http://localhost:3001/api";
const users = [],
  sessions = [],
  codes = [];

async function request(
  path,
  { cookie, method = "GET", body, origin = "http://localhost:3000" } = {},
  expected = 200,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: unexpected status`,
  );
  const data = await response.json();
  let sessionCookie;
  if (response.headers.get("set-cookie")?.startsWith("finance_session=")) {
    sessionCookie = response.headers.get("set-cookie").split(";")[0];
    const token = sessionCookie.split("=")[1];
    if (token)
      sessions.push(
        JSON.parse(Buffer.from(token.split(".")[1], "base64url")).sid,
      );
  }
  return { data, cookie: sessionCookie, headers: response.headers };
}

async function account() {
  const email = `review-check-${randomUUID()}@example.test`,
    password = randomUUID();
  const result = await request(
    "/auth/register",
    { method: "POST", body: { email, password, name: "Review test" } },
    201,
  );
  users.push(result.data.user.id);
  assert.equal(result.data.token, undefined);
  assert.match(result.headers.get("set-cookie"), /HttpOnly/i);
  return {
    email,
    password,
    userId: result.data.user.id,
    cookie: result.cookie,
  };
}

(async () => {
  try {
    const a = await account(),
      b = await account();
    const owned = (cookie, method, body) => ({ cookie, method, body });
    const categoriesA = (await request("/categories", { cookie: a.cookie }))
      .data;
    const categoriesB = (await request("/categories", { cookie: b.cookie }))
      .data;
    const expense = categoriesA.find((c) => c.type === "EXPENSE"),
      foreignCategory = categoriesB[0];
    const walletA = (
      await request(
        "/wallets",
        owned(a.cookie, "POST", {
          name: "Review wallet",
          type: "CASH",
          balance: 100,
        }),
        201,
      )
    ).data;
    const walletB = (
      await request(
        "/wallets",
        owned(b.cookie, "POST", { name: "Other wallet", type: "CASH" }),
        201,
      )
    ).data;
    const transaction = {
      walletId: walletA.id,
      categoryId: expense.id,
      amount: 10.1,
      transactionDate: "2026-11-07",
    };
    await request(
      "/users/me",
      owned(a.cookie, "PATCH", { passwordHash: "injected" }),
      400,
    );
    await request(
      "/transactions",
      owned(a.cookie, "POST", { ...transaction, userId: b.userId }),
      400,
    );
    await request(
      "/transactions",
      owned(a.cookie, "POST", { ...transaction, walletId: walletB.id }),
      404,
    );
    await request(
      "/transactions",
      owned(a.cookie, "POST", {
        ...transaction,
        categoryId: foreignCategory.id,
      }),
      404,
    );
    for (const amount of [-1, 0, "10", 1e-100])
      await request(
        "/transactions",
        owned(a.cookie, "POST", { ...transaction, amount }),
        400,
      );
    await request(
      "/transactions",
      owned(a.cookie, "POST", {
        ...transaction,
        transactionDate: "2026-02-31",
      }),
      400,
    );
    console.log(
      "Request validation, overposting and cross-account transaction access: passed",
    );

    const entry = (
      await request("/transactions", owned(a.cookie, "POST", transaction), 201)
    ).data;
    assert.ok(new Prisma.Decimal(entry.wallet.balance).equals("89.9"));
    await request(`/transactions/${entry.id}`, { cookie: b.cookie }, 404);
    await request(
      `/transactions/${entry.id}`,
      owned(b.cookie, "PATCH", { amount: 1 }),
      404,
    );
    await request(`/transactions/${entry.id}`, owned(b.cookie, "DELETE"), 404);
    await request(
      `/transactions/${entry.id}`,
      owned(a.cookie, "PATCH", { walletId: walletB.id }),
      404,
    );
    await Promise.all(
      [20.2, 30.3].map((amount) =>
        request(
          `/transactions/${entry.id}`,
          owned(a.cookie, "PATCH", { amount }),
        ),
      ),
    );
    const current = (
      await request(`/transactions/${entry.id}`, { cookie: a.cookie })
    ).data;
    assert.ok(
      new Prisma.Decimal(current.wallet.balance).equals(
        new Prisma.Decimal(100).minus(current.amount),
      ),
    );
    await request(
      `/categories/${expense.id}`,
      owned(a.cookie, "PATCH", { type: "INCOME" }),
      409,
    );
    await request(`/wallets/${walletA.id}`, owned(a.cookie, "DELETE"), 409);
    console.log(
      "Concurrent money edits, category integrity and friendly constraint errors: passed",
    );

    const receipt = (
      await request(
        "/receipts",
        owned(a.cookie, "POST", { fileUrl: "telegram:review-image" }),
        201,
      )
    ).data;
    await request(
      `/receipts/${receipt.id}/status`,
      owned(b.cookie, "PATCH", { status: "COMPLETED" }),
      404,
    );
    await request(
      `/receipts/${receipt.id}/link-transaction`,
      owned(b.cookie, "PATCH", { transactionId: entry.id }),
      404,
    );
    await request(
      `/receipts/${receipt.id}/link-transaction`,
      owned(a.cookie, "PATCH", { transactionId: entry.id }),
    );
    console.log("Receipt update and link ownership: passed");

    for (let index = 0; index < 51; index++)
      await request(
        "/transactions",
        owned(a.cookie, "POST", { ...transaction, amount: 1 }),
        201,
      );
    const first = (
      await request("/transactions?limit=51&offset=0", { cookie: a.cookie })
    ).data;
    const next = (
      await request("/transactions?limit=51&offset=50", { cookie: a.cookie })
    ).data;
    assert.equal(first.length, 51);
    assert.equal(next.length, 2);
    assert.equal(
      new Set([...first.slice(0, 50), ...next].map((t) => t.id)).size,
      52,
    );
    for (const query of [
      "limit=bad",
      "offset=-1",
      "startDate=2026-12-01&endDate=2026-01-01",
    ])
      await request(`/transactions?${query}`, { cookie: a.cookie }, 400);
    const summary = (
      await request("/transactions/summary", { cookie: a.cookie })
    ).data;
    assert.ok(
      new Prisma.Decimal(summary.totalExpense).equals(
        new Prisma.Decimal(current.amount).plus(51),
      ),
    );
    console.log(
      "Pagination after 50 rows, invalid filters and database summary totals: passed",
    );

    await request(
      "/users/telegram/link",
      owned(a.cookie, "POST", { code: "123456789" }),
      400,
    );
    const code = randomBytes(16).toString("hex"),
      telegramId = String(randomInt(100000000000, 999999999999));
    codes.push(code);
    await redis.set(`telegram-link:${code}`, telegramId, "EX", 600);
    const linked = await request(
      "/users/telegram/link",
      owned(a.cookie, "POST", { code }),
      201,
    );
    assert.equal(linked.data.telegramId, telegramId);
    await request(
      "/users/telegram/link",
      owned(b.cookie, "POST", { code }),
      400,
    );
    await request("/users/telegram/link", owned(a.cookie, "DELETE"));
    const login = await request(
      "/auth/login",
      {
        method: "POST",
        origin: new URL(base).origin,
        body: { email: a.email.toUpperCase(), password: a.password },
      },
      201,
    );
    assert.equal(login.data.user.id, a.userId);
    await request("/auth/logout", owned(login.cookie, "POST"), 201);
    await request("/auth/me", { cookie: login.cookie }, 401);
    console.log(
      "One-time Telegram proof, case-insensitive login and logout revocation: passed",
    );

    const integrity =
      await prisma.$queryRaw`SELECT COUNT(*) AS count FROM "Transaction" t JOIN "Wallet" w ON t."walletId" = w.id JOIN "Category" c ON t."categoryId" = c.id WHERE t."userId" <> w."userId" OR t."userId" <> c."userId"`;
    console.log(
      `Existing cross-account transaction references: ${integrity[0].count}`,
    );
  } finally {
    if (users.length)
      await prisma.$transaction([
        prisma.receipt.deleteMany({ where: { userId: { in: users } } }),
        prisma.transaction.deleteMany({ where: { userId: { in: users } } }),
        prisma.wallet.deleteMany({ where: { userId: { in: users } } }),
        prisma.category.deleteMany({ where: { userId: { in: users } } }),
        prisma.user.deleteMany({ where: { id: { in: users } } }),
      ]);
    for (const id of sessions) await redis.del(`session:${id}`);
    for (const code of codes) await redis.del(`telegram-link:${code}`);
    await prisma.$disconnect();
    redis.disconnect();
    console.log(
      "Temporary integration accounts, financial records and sessions removed",
    );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
