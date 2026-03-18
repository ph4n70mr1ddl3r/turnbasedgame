import { isDevelopment } from "./logger";

export function reloadPage(): void {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export interface StorageSetResult {
  success: boolean;
  quotaExceeded?: boolean;
}

interface SafeLocalStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => StorageSetResult;
  removeItem: (key: string) => boolean;
  clear: () => boolean;
}

const NOOP_STORAGE: SafeLocalStorage = {
  getItem: () => null,
  setItem: () => ({ success: false }),
  removeItem: () => false,
  clear: () => false,
};

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

export function safeLocalStorage(): SafeLocalStorage {
  if (!isBrowser()) {
    return NOOP_STORAGE;
  }

  const IS_DEV = isDevelopment();
  
  return {
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
    setItem: (key: string, value: string): StorageSetResult => {
      try {
        localStorage.setItem(key, value);
        return { success: true };
      } catch (error) {
        if (IS_DEV) {
          console.warn("[WARN] localStorage.setItem failed:", error);
        }
        return { 
          success: false, 
          quotaExceeded: isQuotaExceededError(error) 
        };
      }
    },
    removeItem: (key: string): boolean => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        if (IS_DEV) {
          console.warn("[WARN] localStorage.removeItem failed:", error);
        }
        return false;
      }
    },
    clear: (): boolean => {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        if (IS_DEV) {
          console.warn("[WARN] localStorage.clear failed:", error);
        }
        return false;
      }
    },
  };
}
