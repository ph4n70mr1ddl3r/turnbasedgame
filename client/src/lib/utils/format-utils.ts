export function formatTimeRemaining(ms: number | undefined): string {
  if (!ms || ms <= 0) return '-';
  return `${Math.ceil(ms / 1000)}s`;
}

export function formatChips(amount: number): string {
  return amount.toLocaleString();
}
