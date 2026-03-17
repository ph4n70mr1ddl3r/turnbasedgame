import { SESSION_TOKEN_KEY, PLAYER_ID_KEY, SESSION_EXPIRY_KEY } from "@/lib/constants/storage";
import { SESSION_DURATION_MS } from "@/lib/constants/game";
import { logError } from "@/lib/utils/logger";
import { isValidPlayerId } from "@/types/game-types";
import { safeLocalStorage } from "@/lib/utils/browser-utils";

export interface SessionData {
  token: string;
  playerId: string;
  expiry: number;
}

/**
 * SECURITY NOTE: Session tokens are stored in localStorage for persistence across
 * page reloads. This is a trade-off between UX and security:
 * - localStorage is vulnerable to XSS attacks
 * - For production, consider:
 *   1. Server-set HttpOnly cookies (requires server changes)
 *   2. Short session durations with automatic refresh
 *   3. Token rotation on each reconnection
 * - Ensure CSP headers are properly configured to mitigate XSS risks
 *
 * Token validation relies on:
 * 1. UUID format validation (cryptographically generated)
 * 2. Server-side token verification on each message
 * 3. Session expiry checking
 */
export class SessionManager {

  private static validateTokenFormat(token: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(token);
  }

  static getSession(): SessionData | null {
    const storage = safeLocalStorage();

    try {
      const token = storage.getItem(SESSION_TOKEN_KEY);
      const playerId = storage.getItem(PLAYER_ID_KEY);
      const expiryStr = storage.getItem(SESSION_EXPIRY_KEY);

      if (!token || !playerId || !expiryStr) {
        return null;
      }

      if (!this.validateTokenFormat(token)) {
        logError("Invalid token format detected, clearing session");
        this.clearSession();
        return null;
      }

      if (!isValidPlayerId(playerId)) {
        logError("Invalid playerId format detected, clearing session");
        this.clearSession();
        return null;
      }

      const expiry = parseInt(expiryStr, 10);

      if (!Number.isFinite(expiry) || expiry <= 0) {
        logError("Invalid session expiry, clearing session");
        this.clearSession();
        return null;
      }

      const now = Date.now();

      if (now > expiry) {
        this.clearSession();
        return null;
      }

      return { token, playerId, expiry };
    } catch (error) {
      logError("Error reading session from localStorage:", error);
      return null;
    }
  }

  static createSession(token: string, playerId: string): SessionData {
    if (!this.validateTokenFormat(token)) {
      logError("Attempted to create session with invalid token format");
      throw new Error("Invalid token format");
    }

    if (!isValidPlayerId(playerId)) {
      logError("Attempted to create session with invalid playerId format");
      throw new Error("Invalid playerId format");
    }

    const expiry = Date.now() + SESSION_DURATION_MS;
    const session: SessionData = { token, playerId, expiry };

    const storage = safeLocalStorage();
    storage.setItem(SESSION_TOKEN_KEY, token);
    storage.setItem(PLAYER_ID_KEY, playerId);
    storage.setItem(SESSION_EXPIRY_KEY, expiry.toString());

    return session;
  }

  static updateSessionExpiry(): boolean {
    const session = this.getSession();
    if (!session) return false;
    
    const newExpiry = Date.now() + SESSION_DURATION_MS;
    const storage = safeLocalStorage();
    storage.setItem(SESSION_EXPIRY_KEY, newExpiry.toString());
    return true;
  }

  static clearSession(): void {
    const storage = safeLocalStorage();
    storage.removeItem(SESSION_TOKEN_KEY);
    storage.removeItem(PLAYER_ID_KEY);
    storage.removeItem(SESSION_EXPIRY_KEY);
  }

  static isValidSession(): boolean {
    return this.getSession() !== null;
  }

  static getRemainingSessionTime(): number {
    const session = this.getSession();
    if (!session) return 0;
    
    const now = Date.now();
    return Math.max(0, session.expiry - now);
  }

  static generateToken(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      try {
        return globalThis.crypto.randomUUID();
      } catch (error) {
        logError("Failed to generate UUID using crypto API:", error);
      }
    }

    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      try {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      } catch (error) {
        logError("Failed to generate UUID using getRandomValues:", error);
      }
    }

    throw new Error("No cryptographically secure random number generator available");
  }
}