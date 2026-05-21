import { logWarn } from "./logger";
import { SESSION_TOKEN_KEY, PLAYER_ID_KEY, SESSION_EXPIRY_KEY } from "@/lib/constants/storage";

const APP_STORAGE_KEYS = [SESSION_TOKEN_KEY, PLAYER_ID_KEY, SESSION_EXPIRY_KEY] as const;

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

let cachedStorage: SafeLocalStorage | null = null;

export function safeLocalStorage(): SafeLocalStorage {
  if (!isBrowser()) {
    return NOOP_STORAGE;
  }

  if (!cachedStorage) {
    cachedStorage = {
      getItem: (key: string): string | null => {
        try {
          return localStorage.getItem(key);
        } catch (error) {
          logWarn('localStorage.getItem failed:', error);
          return null;
        }
      },
      setItem: (key: string, value: string): StorageSetResult => {
        try {
          localStorage.setItem(key, value);
          return { success: true };
        } catch (error) {
          logWarn('localStorage.setItem failed:', error);
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
          logWarn('localStorage.removeItem failed:', error);
          return false;
        }
      },
      clear: (): boolean => {
        try {
          for (const key of APP_STORAGE_KEYS) {
            try {
              localStorage.removeItem(key);
            } catch {
              // Continue removing other keys even if one fails
            }
          }
          return true;
        } catch (error) {
          logWarn('localStorage.clear failed:', error);
          return false;
        }
      },
    };
  }

  return cachedStorage;
}
