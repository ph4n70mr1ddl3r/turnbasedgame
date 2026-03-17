import { isDevelopment } from "./logger";

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

  const IS_DEV = isDevelopment();
  
  cachedStorage = {
    getItem: (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        if (IS_DEV) {
          console.warn("[WARN] localStorage.getItem failed:", error);
        }
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        if (IS_DEV) {
          console.warn("[WARN] localStorage.setItem failed:", error);
        }
      }
    },
    removeItem: (key: string): void => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        if (IS_DEV) {
          console.warn("[WARN] localStorage.removeItem failed:", error);
        }
      }
    },
    clear: (): void => {
      try {
        localStorage.clear();
      } catch (error) {
        if (IS_DEV) {
          console.warn("[WARN] localStorage.clear failed:", error);
        }
      }
    },
  };

  return cachedStorage;
}
