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

export interface WalletRow {
  name: string;
  type: string;
  balance: number;
}

export const HELP_TEXT = [
  "Finance Tracker bot",
  "",
  "/login <email> <password> - link this Telegram account",
  "/whoami - show the linked account",
  "/logout - unlink this Telegram account",
  "/wallets - list your wallets and balances",
  "/balance - same as /wallets",
  "/help - show this message",
].join("\n");

export function renderWalletsMessage(wallets: WalletRow[]): string {
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
    "Your wallets:",
    "",
    ...lines,
    "",
    `Total: ${formatRupiah(total)}`,
  ].join("\n");
}
