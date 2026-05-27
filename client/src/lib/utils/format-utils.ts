export function formatTimeRemaining(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-';
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '-';
  if (ms === 0) return '0s';
  const seconds = Math.ceil(ms / 1000);
  // Cap display at a reasonable maximum (1 hour)
  if (seconds > 3600) return '3600s+';
  // For sub-second values, show milliseconds for urgency
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${seconds}s`;
}

export function formatChipAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0';
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '0';
  // Defensive: negative chip amounts should never occur; clamp to 0 and let the caller investigate
  if (amount < 0) return '0';
  return amount.toLocaleString();
}
