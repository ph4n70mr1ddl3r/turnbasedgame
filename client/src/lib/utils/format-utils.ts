export function formatTimeRemaining(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return '-';
  return `${Math.ceil(ms / 1000)}s`;
}

export function formatChips(amount: number): string {
  return amount.toLocaleString();
}
