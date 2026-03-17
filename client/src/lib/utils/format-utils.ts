export function formatTimeRemaining(ms: unknown): string {
  if (ms === null || ms === undefined) return '-';
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '-';
  return `${Math.ceil(ms / 1000)}s`;
}
