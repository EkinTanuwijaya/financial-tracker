const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
};
const { createTransactionSchema, updateTransactionSchema, registerSchema, createCategorySchema } = require("../src/dto/index.ts");
const { validateOrThrow } = require("../src/validation/index.ts");
test("transaction schemas accept Prisma CUIDs and calendar dates without adding defaults to patches", () => {
  const input = { walletId: "c" + "a".repeat(24), categoryId: "c" + "b".repeat(24), amount: 10, transactionDate: "2026-11-07" };
  assert.equal(createTransactionSchema.parse(input).currency, "IDR");
  assert.deepEqual(updateTransactionSchema.parse({ description: "Corrected" }), { description: "Corrected" });
  assert.throws(() => createTransactionSchema.parse({ ...input, transactionDate: "2026-02-31" }));
  assert.throws(() => createTransactionSchema.parse({ ...input, amount: 1e-100 }));
});
test("registration normalizes email and prevents bcrypt password truncation", () => {
  assert.equal(registerSchema.parse({ email: " User@Example.com ", password: "password" }).email, "user@example.com");
  assert.throws(() => registerSchema.parse({ email: "user@example.com", password: "é".repeat(37) }));
  assert.throws(() => createCategorySchema.parse({ name: "   ", type: "EXPENSE" }));
});
test("validation errors use Zod 4's issues field", () => {
  assert.throws(() => validateOrThrow(registerSchema, { email: "bad", password: "password" }), /Validation failed: email:/);
});
