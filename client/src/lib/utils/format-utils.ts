export function formatTimeRemaining(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-';
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '-';
  const seconds = Math.ceil(ms / 1000);
  // Cap display at a reasonable maximum (1 hour)
  if (seconds > 3600) return '3600s+';
  return `${seconds}s`;
}
