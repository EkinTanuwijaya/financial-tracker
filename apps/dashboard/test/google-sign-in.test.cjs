const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const { JSDOM } = require(require.resolve("jsdom", { paths: [require.resolve("jest-environment-jsdom")] }));

require.extensions[".tsx"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
};

test("Google sign-in handles missing config, token handoff, busy state, and script failure", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const { act } = require("react-dom/test-utils");
  const { createRoot } = require("react-dom/client");
  const originalLoad = Module._load;
  const originalClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  let scriptError;
  function Script({ onReady, onError }) {
    scriptError = onError;
    React.useEffect(() => { onReady(); }, []);
    return null;
  }
  Module._load = function (name, ...args) {
    return name === "next/script" ? Script : originalLoad.call(this, name, ...args);
  };
  let GoogleSignIn;
  try { GoogleSignIn = require("../src/components/GoogleSignIn.tsx").default; }
  finally { Module._load = originalLoad; }
  const root = createRoot(document.getElementById("root"));
  let received;
  let options;
  let renders = 0;
  let buttonOptions;
  const onCredential = async (credential) => { received = credential; };
  window.google = { accounts: { id: {
    initialize: (value) => { options = value; },
    renderButton: (element, value) => { renders++; buttonOptions = value; element.innerHTML = '<button>Sign in with Google</button>'; },
  } } };
  try {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    await act(async () => root.render(React.createElement(GoogleSignIn, { onCredential })));
    assert.match(document.body.textContent, /not available yet/);
    assert.equal(options, undefined);

    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-web-client-id";
    await act(async () => root.render(React.createElement(GoogleSignIn, { onCredential })));
    assert.equal(options.client_id, "test-web-client-id");
    assert.match(document.body.textContent, /Sign in with Google/);
    assert.equal(buttonOptions.text, "signin_with");
    assert.equal(buttonOptions.size, "medium");
    await act(async () => window.dispatchEvent(new window.Event("resize")));
    assert.equal(renders, 2);
    await act(async () => options.callback({ credential: "google-id-token" }));
    assert.equal(received, "google-id-token");

    await act(async () => root.render(React.createElement(GoogleSignIn, { onCredential, disabled: true })));
    await act(async () => options.callback({ credential: "second-token" }));
    assert.equal(received, "google-id-token");

    await act(async () => scriptError());
    assert.match(document.querySelector('[role="status"]').textContent, /could not load/);
  } finally {
    act(() => root.unmount());
    dom.window.close();
    if (originalClientId === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    else process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = originalClientId;
  }
});
