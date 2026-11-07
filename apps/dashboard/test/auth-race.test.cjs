const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const { JSDOM } = require(require.resolve("jsdom", { paths: [require.resolve("jest-environment-jsdom")] }));
for (const extension of [".tsx", ".ts"]) require.extensions[extension] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
};

test("late session restoration cannot log out a new login or restore a logged-out profile", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000" });
  global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.localStorage = dom.window.localStorage;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react"), { act } = React;
  const { createRoot } = require("react-dom/client");
  let revision = 0, resolveBoot, rejectBoot, auth;
  const profile = { id: "new-user", email: "test@example.test" };
  const api = {
    currentAuthRevision: () => revision, invalidateAuthRequests: () => ++revision,
    authApi: {
      me: () => new Promise((resolve, reject) => { resolveBoot = resolve; rejectBoot = reject; }),
      login: async () => ({ user: profile }), logout: async () => ({}), activity: async () => ({}),
    },
  };
  const originalLoad = Module._load;
  Module._load = function (name, ...args) { return name === "./api" ? api : originalLoad.call(this, name, ...args); };
  let AuthProvider, useAuth;
  try { ({ AuthProvider, useAuth } = require("../src/lib/auth.tsx")); }
  finally { Module._load = originalLoad; }
  function Probe() { auth = useAuth(); return null; }
  const root = createRoot(document.getElementById("root"));
  const render = key => React.createElement(AuthProvider, { key }, React.createElement(Probe));
  try {
    await act(async () => root.render(render("first")));
    await act(async () => auth.login("test@example.test", "password"));
    assert.equal(auth.user.id, profile.id);
    await act(async () => rejectBoot(new Error("stale unauthorized")));
    assert.equal(auth.user.id, profile.id);
    await act(async () => root.render(render("second")));
    await act(async () => auth.logout());
    await act(async () => resolveBoot(profile));
    assert.equal(auth.user, null);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
