export function compactOcrText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\r\n]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
