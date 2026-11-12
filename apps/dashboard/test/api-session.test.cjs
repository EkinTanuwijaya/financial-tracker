const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
test("stale unauthorized requests cannot expire a newer login", async () => {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require.resolve("../src/lib/api.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("module", "exports", source)(module, module.exports);
  const { apiRequest, invalidateAuthRequests } = module.exports;
  const oldFetch = global.fetch, oldWindow = global.window;
  global.window = new EventTarget();
  let expired = 0, finish;
  window.addEventListener("auth:expired", () => expired++);
  global.fetch = async (_url, options) => { assert.equal(options.credentials, "include"); return new Promise(resolve => { finish = resolve; }); };
  try {
    const stale = apiRequest("/auth/me").catch(error => error.statusCode);
    invalidateAuthRequests();
    finish(new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }));
    assert.equal(await stale, 401); assert.equal(expired, 0);
    const current = apiRequest("/wallets").catch(error => error.statusCode);
    finish(new Response("{}", { status: 401 }));
    assert.equal(await current, 401); assert.equal(expired, 1);
  } finally { global.fetch = oldFetch; global.window = oldWindow; }
});
