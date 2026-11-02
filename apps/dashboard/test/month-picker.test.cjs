const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { JSDOM } = require(require.resolve("jsdom", {
  paths: [require.resolve("jest-environment-jsdom")],
}));

require.extensions[".tsx"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
};

test("month picker opens, changes years, selects a month, and closes with Escape or focus outside", () => {
  const dom = new JSDOM('<div id="root"></div><button id="outside">Outside</button>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const { act } = require("react-dom/test-utils");
  const { createRoot } = require("react-dom/client");
  const MonthPicker = require("../src/components/MonthPicker.tsx").default;
  const root = createRoot(document.getElementById("root"));
  let selected;
  function Harness() {
    const [value, setValue] = React.useState("2026-11");
    return React.createElement(MonthPicker, { value, onChange: (month) => { selected = month; setValue(month); } });
  }
  const click = (selector) => act(() => document.querySelector(selector).click());
  try {
    act(() => root.render(React.createElement(Harness)));
    click(".month-control");
    assert.equal(document.querySelectorAll(".month-picker-grid button").length, 12);
    click('[aria-label="Previous year"]');
    assert.ok(document.querySelector('[aria-label="September 2025"]'));
    click('[aria-label="Next year"]');
    click('[aria-label="September 2026"]');
    assert.equal(selected, "2026-09");
    assert.match(document.querySelector(".month-control").textContent, /September 2026/);
    assert.equal(document.querySelector(".month-picker-panel"), null);
    assert.equal(document.activeElement, document.querySelector(".month-control"));
    click(".month-control");
    act(() => document.querySelector(".month-control").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    assert.equal(document.querySelector(".month-picker-panel"), null);
    click(".month-control");
    act(() => document.getElementById("outside").focus());
    assert.equal(document.querySelector(".month-picker-panel"), null);
  } finally {
    act(() => root.unmount());
    dom.window.close();
  }
});
