const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { JSDOM } = require(require.resolve("jsdom", { paths: [require.resolve("jest-environment-jsdom")] }));

test("idle session expires after two hours, renews only on activity, syncs tabs, and checks wake-up", () => {
  const dom = new JSDOM("", { url: "http://localhost:3000", pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  const originalNow = Date.now;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  let now = 1000000, id = 0;
  const timers = new Map();
  Date.now = () => now;
  global.setTimeout = (callback, delay) => { timers.set(++id, { at: now + delay, callback }); return id; };
  global.clearTimeout = (key) => timers.delete(key);
  const advance = (duration) => {
    const end = now + duration;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    now = end;
  };
  const filename = require.resolve("../src/lib/idle-session.ts");
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", source)(module, module.exports);
  const { watchIdleSession, IDLE_TIMEOUT_MS, ACTIVITY_KEY } = module.exports;
  let expired = 0, renewed = 0;
  const start = () => {
    localStorage.setItem(ACTIVITY_KEY, String(now));
    return watchIdleSession(() => expired++, async () => { renewed++; });
  };
  try {
    let stop = start();
    advance(IDLE_TIMEOUT_MS - 1);
    assert.equal(expired, 0); assert.equal(renewed, 0);
    advance(1); assert.equal(expired, 1); stop();

    stop = start(); advance(60000);
    window.dispatchEvent(new window.Event("pointerdown")); advance(0);
    assert.equal(renewed, 1);
    advance(1000); window.dispatchEvent(new window.Event("keydown"));
    advance(59000); assert.equal(renewed, 2);
    advance(IDLE_TIMEOUT_MS - 59001); assert.equal(expired, 1);
    advance(1); assert.equal(expired, 2); stop();

    stop = start(); advance(60000);
    window.dispatchEvent(new window.StorageEvent("storage", { key: ACTIVITY_KEY, newValue: String(now) }));
    advance(IDLE_TIMEOUT_MS - 1); assert.equal(expired, 2);
    advance(1); assert.equal(expired, 3); stop();

    stop = start(); now += IDLE_TIMEOUT_MS;
    window.dispatchEvent(new window.Event("focus"));
    assert.equal(expired, 4); assert.equal(renewed, 2); stop();

    stop = start();
    window.dispatchEvent(new window.StorageEvent("storage", { key: ACTIVITY_KEY, newValue: null }));
    assert.equal(expired, 5); stop(); advance(0);
    assert.equal(timers.size, 0);
  } finally {
    Date.now = originalNow;
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    dom.window.close();
  }
});
