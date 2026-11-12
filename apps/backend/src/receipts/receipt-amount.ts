function parseAmount(value: string): number | null {
  let normalized: string;
  if (/^\d+$/.test(value)) normalized = value;
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{2})?$/.test(value)) normalized = value.replace(/,/g, "");
  else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{2})?$/.test(value)) normalized = value.replace(/\./g, "").replace(",", ".");
  else if (/^\d+[.,]\d{2}$/.test(value)) normalized = value.replace(",", ".");
  else {
    // shortcut: OCR can fuse two decimal digits after grouped thousands; other malformed amounts need manual correction.
    const fused = value.match(/^(\d{1,3}(?:[.,]\d{3})+)(\d{2})$/);
    if (!fused) return null;
    normalized = `${fused[1].replace(/[.,]/g, "")}.${fused[2]}`;
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Read an explicitly labelled receipt total, without treating account numbers or fees as totals. */
export function receiptAmount(text: string): number | null {
  const totals = [...text.matchAll(
    /^(?:amount|grand total|total(?: pembayaran| bayar)?|jumlah(?: transfer)?)\s*:?\s*(?:(?:IDR|Rp\.?)\s*)?(\d[\d.,]*)(?!\S)/gim,
  )];
  if (!totals.length) return null;
  const amounts = totals.map((match) => parseAmount(match[1]));
  if (amounts.some((amount) => amount === null) || new Set(amounts).size !== 1) {
    throw new Error("Receipt total is ambiguous or unreadable. Please enter the amount manually.");
  }
  return amounts[0];
}
