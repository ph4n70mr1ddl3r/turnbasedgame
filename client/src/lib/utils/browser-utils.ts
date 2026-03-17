export function reloadPage(): void {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

interface SafeLocalStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const NOOP_STORAGE: SafeLocalStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

let cachedStorage: SafeLocalStorage | null = null;

export function safeLocalStorage(): SafeLocalStorage {
  if (cachedStorage) {
    return cachedStorage;
  }

  if (!isBrowser()) {
    cachedStorage = NOOP_STORAGE;
    return cachedStorage;
  }

  cachedStorage = {
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

  return cachedStorage;
}
