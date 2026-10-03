const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatWalletType(type: string): string {
  return type.toLowerCase().replace(/_/g, " ");
}

export function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

function formatShortDateWithYear(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatRowDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Keeps the year visible even when a range crosses a year boundary. */
function formatRangeLabel(start: Date, end: Date): string {
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${formatShortDate(start)} - ${formatShortDate(end)} ${end.getUTCFullYear()}`;
  }
  return `${formatShortDateWithYear(start)} - ${formatShortDateWithYear(end)}`;
}

export interface WalletRow {
  name: string;
  type: string;
  balance: number;
}

export interface TransactionRow {
  amount: number;
  description: string | null;
  categoryName: string;
  categoryType: string;
  walletName: string;
  date: Date;
}

export interface CategoryRow {
  name: string;
  type: string;
  count: number;
  total: number;
}

export const HELP_TEXT = [
  "Finance Tracker bot",
  "",
  "/wallets - list your wallets",
  "/wallet add <name> [type] [balance] - create a wallet",
  "/balance - balances for every wallet",
  "/transaction <date or period> - transactions for a period",
  "/category - list your categories",
  "/category <date or period> - spending grouped by category",
  "/category add <name> [expense|income] - create a category",
  "/whoami - show which account this chat is linked to",
  "/help - show this message",
  "",
  "Dates: today, yesterday, 2026-09-29 or 29-09-2026.",
  "Periods: week, month, year.",
  "Your Telegram account must be linked from the dashboard first.",
].join("\n");

export function renderWalletList(wallets: WalletRow[]): string {
  if (wallets.length === 0) {
    return [
      "You have no wallets yet.",
      "",
      "Add one from the dashboard: Wallets -> + Add wallet.",
    ].join("\n");
  }

  const lines = wallets.map(
    (wallet, index) =>
      `${index + 1}. ${wallet.name} (${formatWalletType(wallet.type)})`,
  );

  return ["Your wallets:", "", ...lines].join("\n");
}

export function renderBalanceMessage(wallets: WalletRow[]): string {
  if (wallets.length === 0) {
    return [
      "You have no wallets yet.",
      "",
      "Add one from the dashboard: Wallets -> + Add wallet.",
    ].join("\n");
  }

  const total = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const lines = wallets.map(
    (wallet, index) =>
      `${index + 1}. ${wallet.name} (${formatWalletType(wallet.type)})\n` +
      `   ${formatRupiah(wallet.balance)}`,
  );

  return [
    "Your balances:",
    "",
    ...lines,
    "",
    `Total: ${formatRupiah(total)}`,
  ].join("\n");
}

// Telegram rejects messages over 4096 characters, so long periods are trimmed
// for display. Totals are still computed from every row.
const MAX_ROWS_SHOWN = 25;
const MAX_DESCRIPTION_LENGTH = 60;
const MAX_CATEGORY_ROWS_SHOWN = 15;

export function renderTransactionsMessage(
  label: string,
  transactions: TransactionRow[],
): string {
  if (transactions.length === 0) {
    return `No transactions for ${label}.`;
  }

  let income = 0;
  let expense = 0;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    if (transaction.categoryType === "INCOME") income += amount;
    else expense += amount;
  }

  const lines = transactions
    .slice(0, MAX_ROWS_SHOWN)
    .map((transaction, index) => {
      const amount = Number(transaction.amount);
      const isIncome = transaction.categoryType === "INCOME";
      const description = transaction.description?.trim();
      const trimmed =
        description && description.length > MAX_DESCRIPTION_LENGTH
          ? `${description.slice(0, MAX_DESCRIPTION_LENGTH - 1)}...`
          : description;

      return (
        `${index + 1}. ${formatRowDate(transaction.date)}  ` +
        `${isIncome ? "+" : "-"}${formatRupiah(amount)}  ` +
        `${transaction.categoryName} - ${transaction.walletName}` +
        (trimmed ? `\n   ${trimmed}` : "")
      );
    });

  const hidden = transactions.length - lines.length;

  return [
    `Transactions for ${label}`,
    "",
    ...lines,
    ...(hidden > 0
      ? [
          "",
          `...and ${hidden} more. Narrow it down with a specific date,`,
          "or view the full list in the dashboard.",
        ]
      : []),
    "",
    `In: ${formatRupiah(income)}`,
    `Out: ${formatRupiah(expense)}`,
    `Net: ${formatRupiah(income - expense)}`,
  ].join("\n");
}

export function renderCategoryList(categories: CategoryRow[]): string {
  if (categories.length === 0) {
    return [
      "You have no categories yet.",
      "",
      "Add one from the dashboard: Categories -> + Add category.",
    ].join("\n");
  }

  const section = (title: string, type: string) => {
    const rows = categories.filter((category) => category.type === type);
    if (rows.length === 0) return [];

    const body = rows.map((category, index) => {
      const used =
        category.count > 0
          ? `${category.count}x, ${formatRupiah(category.total)}`
          : "never used";
      return `${index + 1}. ${category.name} - ${used}`;
    });

    return [title, "", ...body, ""];
  };

  return [
    "Your categories:",
    "",
    ...section("Expense", "EXPENSE"),
    ...section("Income", "INCOME"),
    "Totals cover all transactions, not a single period.",
    "Use /category month to see spending grouped by category.",
  ].join("\n");
}

/** Ranks longest name first so every row line starts at the same column. */
function padRight(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function formatCount(count: number): string {
  return `${count}x`;
}

/**
 * Whole-number shares that add up to exactly 100. Rounding each row on its own
 * drifts (four rows came to 101%), so the total is rounded cumulatively and
 * each row shows the difference from the previous one. The last row therefore
 * always lands on 100.
 */
function formatShares(amounts: number[], total: number): string[] {
  if (total <= 0) return amounts.map(() => "  0%");

  let cumulative = 0;
  let previous = 0;

  return amounts.map((amount) => {
    cumulative += amount;
    const current = Math.round((cumulative / total) * 100);
    const share = current - previous;
    previous = current;
    return `${String(share).padStart(3, " ")}%`;
  });
}

/**
 * Spending for a period, one row per expense category ranked by amount.
 * Percentages are shares of total spending so they sum to 100 across the
 * rows. Income is summarised separately instead of being ranked alongside
 * expenses, which would make every expense look smaller than it is.
 */
export function renderCategoryBreakdown(
  label: string,
  categories: CategoryRow[],
): string {
  if (categories.length === 0) {
    return `No transactions for ${label}.`;
  }

  const expenses = categories.filter((category) => category.type !== "INCOME");
  const income = categories
    .filter((category) => category.type === "INCOME")
    .reduce((sum, category) => sum + category.total, 0);

  if (expenses.length === 0) {
    return [
      `No spending for ${label}.`,
      ...(income > 0 ? ["", `In: ${formatRupiah(income)}`] : []),
    ].join("\n");
  }

  const total = expenses.reduce((sum, category) => sum + category.total, 0);
  const shown = expenses.slice(0, MAX_CATEGORY_ROWS_SHOWN);
  const rest = expenses.slice(MAX_CATEGORY_ROWS_SHOWN);
  const restTotal = rest.reduce((sum, category) => sum + category.total, 0);
  const restCount = rest.reduce((sum, category) => sum + category.count, 0);

  const width = Math.max(...shown.map((category) => category.name.length));

  // The remainder row is ranked last, so its share is computed in that order.
  const shares = formatShares(
    [...shown.map((category) => category.total), restTotal],
    total,
  );

  const lines = shown.map(
    (category, index) =>
      `${index + 1}. ${padRight(category.name, width)}  ` +
      `${formatRupiah(category.total)}  ${shares[index]}  ` +
      `(${formatCount(category.count)})`,
  );

  return [
    `Spending by category - ${label}`,
    "",
    ...lines,
    ...(rest.length > 0
      ? [
          `${shown.length + 1}. ${padRight(`${rest.length} more`, width)}  ` +
            `${formatRupiah(restTotal)}  ${shares[shares.length - 1]}  ` +
            `(${formatCount(restCount)})`,
        ]
      : []),
    "",
    `Out: ${formatRupiah(total)}`,
    ...(income > 0
      ? [`In: ${formatRupiah(income)}`, `Net: ${formatRupiah(income - total)}`]
      : []),
    ...(rest.length > 0
      ? ["", "Use /category week or a specific date to narrow it down."]
      : []),
  ].join("\n");
}

export interface ParsedDate {
  start: Date;
  end: Date;
  label: string;
}

function utcDay(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects impossible dates such as 2026-02-31, which JS would roll over.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function endOfDay(date: Date): Date {
  return new Date(date.getTime() + MS_PER_DAY - 1);
}

function asDay(date: Date): ParsedDate {
  return { start: date, end: endOfDay(date), label: formatDateLabel(date) };
}

function asRange(start: Date, lastDay: Date, label: string): ParsedDate {
  return { start, end: endOfDay(lastDay), label };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Accepts period keywords and the two date orders people actually type.
 * Boundaries are UTC so a period never shifts with the server timezone.
 */
export function parseUserDate(
  input: string,
  now: Date = new Date(),
): ParsedDate | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const today = startOfUtcDay(now);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  if (raw === "today" || raw === "hari ini") return asDay(today);
  if (raw === "yesterday" || raw === "kemarin")
    return asDay(addDays(today, -1));

  if (raw === "week" || raw === "this week" || raw === "minggu ini") {
    // Weeks start on Monday, matching the Indonesian calendar.
    const weekday = (today.getUTCDay() + 6) % 7;
    const start = addDays(today, -weekday);
    const last = addDays(start, 6);
    return asRange(start, last, formatRangeLabel(start, last));
  }

  if (raw === "month" || raw === "this month" || raw === "bulan ini") {
    const start = new Date(Date.UTC(year, month, 1));
    const last = new Date(Date.UTC(year, month + 1, 0));
    return asRange(start, last, formatMonthLabel(start));
  }

  if (raw === "year" || raw === "this year" || raw === "tahun ini") {
    const start = new Date(Date.UTC(year, 0, 1));
    const last = new Date(Date.UTC(year, 11, 31));
    return asRange(start, last, String(year));
  }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const day = utcDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return day ? asDay(day) : null;
  }

  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const day = utcDay(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
    return day ? asDay(day) : null;
  }

  return null;
}

export const DATE_USAGE = [
  "Usage: /transaction <date or period>",
  "",
  "Single day:",
  "/transaction today",
  "/transaction yesterday",
  "/transaction 2026-09-29",
  "/transaction 29-09-2026",
  "",
  "Periods:",
  "/transaction week",
  "/transaction month",
  "/transaction year",
].join("\n");

export const CATEGORY_USAGE = [
  "Usage: /category or /category <date or period>",
  "",
  "All your categories:",
  "/category",
  "",
  "Spending grouped by category:",
  "/category today",
  "/category month",
  "/category year",
  "",
  "Create one:",
  "/category add Makan expense",
].join("\n");

// ---------------------------------------------------------------------------
// Creating wallets and categories
// ---------------------------------------------------------------------------

const MAX_NAME_LENGTH = 40;

/**
 * Stored values plus the words people type. Brand names and everyday nouns
 * ("tunai", "gopay", "gaji") are deliberately absent: they are far more often
 * the *name* of a wallet or category than a request for its type, and treating
 * them as types silently mangled names like "Dompet Tunai".
 */
const WALLET_TYPE_ALIASES: Record<string, string> = {
  cash: "CASH",
  bank: "BANK",
  bankaccount: "BANK",
  ewallet: "EWALLET",
  creditcard: "CREDIT_CARD",
  kartukredit: "CREDIT_CARD",
  credit: "CREDIT_CARD",
  other: "OTHER",
  lainnya: "OTHER",
};

const CATEGORY_TYPE_ALIASES: Record<string, string> = {
  expense: "EXPENSE",
  expenses: "EXPENSE",
  pengeluaran: "EXPENSE",
  keluar: "EXPENSE",
  income: "INCOME",
  incomes: "INCOME",
  pemasukan: "INCOME",
  masuk: "INCOME",
};

/** Strips separators so a token can be matched against an alias table. */
function aliasKey(token: string): string {
  return token.toLowerCase().replace(/[\s_-]/g, "");
}

export function normalizeWalletType(input: string): string | null {
  return WALLET_TYPE_ALIASES[aliasKey(input)] ?? null;
}

export function normalizeCategoryType(input: string): string | null {
  return CATEGORY_TYPE_ALIASES[aliasKey(input)] ?? null;
}

export function walletTypeOptions(): string {
  return "cash, bank, ewallet, credit card, other";
}

export function categoryTypeOptions(): string {
  return "expense, income";
}

/**
 * Parses a rupiah amount. `.` and `,` are always thousands separators, never
 * decimals, matching the dashboard — so `1.500` is 1500 and a bare `1.5` is
 * rejected as malformed grouping rather than silently read as 1.5 rupiah. A
 * single decimal is accepted only when a multiplier makes it unambiguous, as
 * in `1.5jt`. Indonesian shorthands `k`, `rb`, `jt` and `m` multiply the value.
 */
export function parseRupiahAmount(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/\s/g, "");
  if (!raw) return null;

  const match = raw.match(/^(?:rp)?([\d.,]+)(k|rb|ribu|jt|juta|jutaan|m)?$/);
  if (!match) return null;

  const suffix = match[2] ?? "";
  const hasMultiplier = suffix !== "";
  const number = match[1];

  const grouped = /^\d{1,3}(?:[.,]\d{3})*$/.test(number);
  const plain = /^\d+$/.test(number);
  // 1.5jt is a normal way to write 1.5 million; 1.5 on its own is not.
  const decimalWithSuffix =
    hasMultiplier && /^\d{1,3}[.,]\d{1,3}$/.test(number);
  if (!grouped && !plain && !decimalWithSuffix) return null;

  const multiplier = /^(k|rb|ribu)$/.test(suffix)
    ? 1_000
    : /^(jt|juta|jutaan|m)$/.test(suffix)
      ? 1_000_000
      : 1;

  let base: number;
  if (decimalWithSuffix) {
    const [whole, fraction] = number.split(/[.,]/);
    base = Number(whole) + Number(fraction) / Math.pow(10, fraction.length);
  } else {
    // Grouped or plain digits: separators are dropped, never fractional.
    base = Number(number.replace(/[.,]/g, ""));
  }

  const result = Math.round(base * multiplier);
  if (!Number.isSafeInteger(result)) return null;

  return result;
}

export interface ParsedWalletAdd {
  name: string;
  type: string;
  balance: number;
}

export interface ParsedCategoryAdd {
  name: string;
  type: string;
}

/**
 * Splits `add <name...> [type] [balance]`.
 *
 * Type and amount are peeled off the *end* of the argument list, never from
 * the middle. Scanning the whole list was actively harmful: "Bank Central
 * Asia bank" lost its leading "Bank" to the type slot and became "Central
 * Asia". Trailing-only keeps a multi-word name intact.
 *
 * A token wrapped in double quotes is never interpreted, so a wallet genuinely
 * named "Cash" or one ending in a number is still addable.
 */
function splitNameAndOptions(
  args: string[],
  normalizeType: (token: string) => string | null,
): {
  name: string;
  type: string | null;
  amount: number | null;
  unknownType: string | null;
} {
  const rest = [...args];
  let type: string | null = null;
  let amount: number | null = null;
  let unknownType: string | null = null;

  // Peel at most one type and one amount, and never the last remaining token,
  // so there is always something left to be the name.
  while (rest.length > 1) {
    const arg = rest[rest.length - 1];
    if (/^"(.+)"$/.test(arg)) break;

    if (type === null) {
      const asType = normalizeType(arg);
      if (asType) {
        type = asType;
        rest.pop();
        continue;
      }
    }

    if (amount === null) {
      const asAmount = parseRupiahAmount(arg);
      if (asAmount !== null) {
        amount = asAmount;
        rest.pop();
        continue;
      }
    }

    break;
  }

  // A leftover "type"/"jenis" marker means the person meant to name a type.
  for (const arg of rest) {
    if (/^(type|jenis)$/i.test(arg)) unknownType = arg;
  }

  const name = rest
    .map((arg) => {
      const quoted = /^"(.+)"$/.exec(arg);
      return quoted ? quoted[1] : arg;
    })
    .join(" ")
    .trim();

  return { name, type, amount, unknownType };
}

export function parseWalletAdd(
  args: string[],
): ParsedWalletAdd | { error: string } {
  const parsed = splitNameAndOptions(args, normalizeWalletType);

  if (parsed.unknownType) {
    return {
      error: `Tell me the type after the name, for example: /wallet add BCA bank`,
    };
  }
  if (!parsed.name) {
    return { error: "Give the wallet a name." };
  }
  if (parsed.name.length > MAX_NAME_LENGTH) {
    return {
      error: `That name is too long. Keep it under ${MAX_NAME_LENGTH} characters.`,
    };
  }
  if (parsed.amount !== null && parsed.amount < 0) {
    return { error: "The starting balance cannot be negative." };
  }

  return {
    name: parsed.name,
    type: parsed.type ?? "CASH",
    balance: parsed.amount ?? 0,
  };
}

export function parseCategoryAdd(
  args: string[],
): ParsedCategoryAdd | { error: string } {
  const parsed = splitNameAndOptions(args, normalizeCategoryType);

  if (parsed.unknownType) {
    return {
      error:
        "Tell me the type after the name, for example: /category add Makan expense",
    };
  }
  if (parsed.amount !== null) {
    return {
      error:
        "A category does not take an amount. Try: /category add Makan expense",
    };
  }
  if (!parsed.name) {
    return { error: "Give the category a name." };
  }
  if (parsed.name.length > MAX_NAME_LENGTH) {
    return {
      error: `That name is too long. Keep it under ${MAX_NAME_LENGTH} characters.`,
    };
  }

  return { name: parsed.name, type: parsed.type ?? "EXPENSE" };
}

export const WALLET_ADD_USAGE = [
  "Usage: /wallet add <name> [type] [balance]",
  "",
  "/wallet add Dompet Tunai",
  "/wallet add BCA bank 5.000.000",
  "/wallet add GoPay ewallet 250000",
  "",
  `Types: ${walletTypeOptions()}.`,
  "Amounts accept 5.000.000, 5jt or 5000000.",
  `Quote a name to keep it whole: /wallet add "Cash Spare" bank`,
].join("\n");

export const CATEGORY_ADD_USAGE = [
  "Usage: /category add <name> [expense|income]",
  "",
  "/category add Makanan",
  "/category add Gaji income",
  "/category add Transport expense",
  "",
  `Types: ${categoryTypeOptions()}. Defaults to expense.`,
].join("\n");

export function renderWalletCreated(wallet: WalletRow): string {
  return [
    `Added wallet "${wallet.name}".`,
    "",
    `Type: ${formatWalletType(wallet.type)}`,
    `Balance: ${formatRupiah(wallet.balance)}`,
    "",
    "Use it now: /transaction today",
  ].join("\n");
}

export function renderCategoryCreated(category: {
  name: string;
  type: string;
}): string {
  const isIncome = category.type === "INCOME";
  return [
    `Added ${isIncome ? "income" : "expense"} category "${category.name}".`,
    "",
    "It shows up in /category and in the dashboard category list.",
  ].join("\n");
}

export function renderNameTaken(kind: string, name: string): string {
  return [
    `You already have a ${kind} called "${name}".`,
    "",
    `Use ${kind === "wallet" ? "/wallets" : "/category"} to see the ones you have.`,
  ].join("\n");
}
