export function formatLotDate(date: Date): string {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export function buildPsLotNumber(lotCode: string, date: Date, sequence: number): string {
  const normalized = lotCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) throw new Error("Product lot code is required");
  if (sequence < 1 || sequence > 99) throw new Error("Lot sequence must be between 1 and 99");
  return `PS-${normalized}-${formatLotDate(date)}-${String(sequence).padStart(2, "0")}`;
}
