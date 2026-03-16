export function reloadPage(): void {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function safeLocalStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
} {
  if (!isBrowser()) {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    };
  }

  return {
    getItem: (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    removeItem: (key: string): void => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    clear: (): void => {
      try {
        localStorage.clear();
      } catch {
        // Silently fail if localStorage is not available
      }
    },
  };
}
