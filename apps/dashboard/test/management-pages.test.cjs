const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const { JSDOM } = require(
  require.resolve("jsdom", {
    paths: [require.resolve("jest-environment-jsdom")],
  }),
);

for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    module._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText,
      filename,
    );
  };
}

test("management modals preserve editing, handle save errors, restore focus, and refresh transactions", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/dashboard",
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  // jsdom has no native dialog lifecycle; browsers provide focus trapping.
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
    this.querySelector("button, input, select")?.focus();
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const { act } = React;
  const { createRoot } = require("react-dom/client");
  const wallet = {
    id: "cash",
    name: "Cash",
    type: "CASH",
    balance: "50000",
    currency: "IDR",
  };
  const category = { id: "food", name: "Food", type: "EXPENSE" };
  const requests = [];
  const created = [];
  let finishTransaction;
  let categoryAttempts = 0;
  const api = {
    walletsApi: {
      list: async () => [wallet],
      create: async (data) => {
        created.push(data);
      },
    },
    categoriesApi: {
      list: async () => [category],
      create: async (data) => {
        if (categoryAttempts++ === 0) throw new Error("Category save failed");
        created.push(data);
      },
    },
    transactionsApi: {
      create: async (data) => {
        created.push(data);
        await new Promise((resolve) => {
          finishTransaction = resolve;
        });
      },
      summary: async () => ({
        totalExpense: 10000,
        byCategory: { Food: { income: 0, expense: 10000 } },
      }),
      list: async (params) => {
        requests.push(params);
        return [
          {
            id: "lunch",
            amount: "10000",
            description: "Lunch",
            transactionDate: "2026-11-08",
            wallet,
            category,
          },
        ];
      },
    },
  };
  const originalLoad = Module._load;
  let pages;
  try {
    Module._load = function (request, ...args) {
      if (request === "@/lib/api") return api;
      if (request === "next/navigation")
        return {
          useRouter: () => ({
            push: () => assert.fail("Modal save must not navigate"),
            refresh: () => {},
          }),
        };
      if (request.startsWith("@/"))
        return originalLoad.call(
          this,
          require.resolve(`../src/${request.slice(2)}`),
          ...args,
        );
      if (request === "next/link")
        return {
          __esModule: true,
          default: ({ children, ...props }) =>
            React.createElement("a", props, children),
        };
      return originalLoad.call(this, request, ...args);
    };
    pages = ["wallets", "categories", "transactions"].map(
      (page) => require(`../src/app/dashboard/${page}/page.tsx`).default,
    );
  } finally {
    Module._load = originalLoad;
  }
  const root = createRoot(document.getElementById("root"));
  const render = async (Page) =>
    act(async () => {
      root.render(React.createElement(Page));
    });
  const click = async (selector) =>
    act(async () => {
      document.querySelector(selector).click();
    });
  try {
    await render(pages[0]);
    assert.equal(document.querySelectorAll(".wallet-account-row").length, 1);
    await click('[aria-label="Edit Cash"]');
    assert.equal(document.querySelector("#name").value, "Cash");
    await click('[aria-label="Close wallet form"]');
    assert.equal(document.querySelector("form"), null);
    const walletTrigger = document.querySelector(".overview-heading button");
    walletTrigger.focus();
    await click(".overview-heading button");
    assert.ok(document.querySelector("dialog[open]"));
    assert.equal(document.body.style.overflow, "hidden");
    await act(async () =>
      document
        .querySelector("form")
        .dispatchEvent(
          new window.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(created.length, 1);
    assert.equal(document.querySelector("dialog"), null);
    assert.equal(document.activeElement, walletTrigger);
    assert.equal(document.body.style.overflow, "");

    await render(pages[1]);
    assert.match(
      document.querySelector('[aria-label="Expense categories"]').textContent,
      /Food/,
    );
    assert.match(
      document.querySelector('[aria-label="Income categories"]').textContent,
      /No income categories yet/,
    );
    await click('[aria-label="Edit Food"]');
    assert.equal(document.querySelector("#name").value, "Food");
    assert.equal(document.querySelector("#type").value, "EXPENSE");
    await act(async () =>
      document
        .querySelector("dialog")
        .dispatchEvent(new window.Event("cancel", { cancelable: true })),
    );
    assert.equal(document.querySelector("dialog"), null);
    await click(".overview-heading .primary-action");
    await act(async () =>
      document
        .querySelector("form")
        .dispatchEvent(
          new window.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.match(
      document.querySelector('dialog [role="alert"]').textContent,
      /Category save failed/,
    );
    assert.equal(
      document.querySelector("dialog").getAttribute("aria-busy"),
      "false",
    );
    await act(async () =>
      document
        .querySelector("form")
        .dispatchEvent(
          new window.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(created.length, 2);
    assert.equal(document.querySelector("dialog"), null);

    await render(pages[2]);
    assert.match(
      document.querySelector(".transaction-workspace").textContent,
      /Lunch/,
    );
    await act(async () => {
      const select = document.querySelector("select");
      select.value = "cash";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(requests.at(-1).walletId, "cash");
    await click(".filter-panel button");
    assert.equal(requests.at(-1).walletId, undefined);
    assert.equal(document.querySelector("select").value, "");
    await click(".overview-heading .primary-action");
    const beforeSaveRequests = requests.length;
    assert.ok(document.querySelector("dialog[open] #amount"));
    await act(async () =>
      document
        .querySelector("dialog form")
        .dispatchEvent(
          new window.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(
      document.querySelector("dialog").getAttribute("aria-busy"),
      "true",
    );
    await act(async () =>
      document
        .querySelector("dialog")
        .dispatchEvent(new window.Event("cancel", { cancelable: true })),
    );
    assert.ok(
      document.querySelector("dialog"),
      "Escape cannot dismiss an in-flight save",
    );
    await act(async () => finishTransaction());
    assert.equal(document.querySelector("dialog"), null);
    assert.ok(
      requests.length > beforeSaveRequests,
      "Saving refreshes transactions",
    );
    await click(".overview-heading .primary-action");
    await click("dialog");
    assert.equal(document.querySelector("dialog"), null);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
