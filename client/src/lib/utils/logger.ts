export function logError(message: string, error?: unknown): void {
  if (process.env.NODE_ENV === "development") {
    if (error) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }
}

export function logWarn(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === "development") {
    if (data) {
      console.warn(message, data);
    } else {
      console.warn(message);
    }
  }
}
