import { SESSION_TOKEN_KEY, PLAYER_ID_KEY, SESSION_EXPIRY_KEY } from "@/lib/constants/storage";
import { SESSION_DURATION_MS } from "@/lib/constants/game";
import { logError } from "@/lib/utils/logger";

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
   *   4. Using async SHA-256 hashing for better integrity (requires async createSession)
   * - Ensure CSP headers are properly configured to mitigate XSS risks
   */
export class SessionManager {
  private static async generateIntegrityHashAsync(token: string, playerId: string): Promise<string> {
    const data = `${token}:${playerId}:${SESSION_DURATION_MS}`;
    
    if (typeof globalThis.crypto?.subtle?.digest === 'function') {
      try {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
      } catch (error) {
        logError("Failed to generate SHA-256 hash, using fallback:", error);
      }
    }
    
    return this.generateIntegrityHashSync(token, playerId);
  }

  private static generateIntegrityHashSync(token: string, playerId: string): string {
    const data = `${token}:${playerId}:${SESSION_DURATION_MS}`;
    let hash1 = 0;
    let hash2 = 0;
    
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash1 = ((hash1 << 5) - hash1) + char;
      hash1 = hash1 & hash1;
      hash2 = ((hash2 << 7) - hash2) + char;
      hash2 = hash2 & hash2;
    }
    
    const combined = Math.abs(hash1).toString(36) + Math.abs(hash2).toString(36);
    return combined.substring(0, 16);
  }

  private static generateIntegrityHash(token: string, playerId: string): string {
    return this.generateIntegrityHashSync(token, playerId);
  }

  private static validateTokenFormat(token: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(token);
  }

  static getSession(): SessionData | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      const playerId = localStorage.getItem(PLAYER_ID_KEY);
      const expiryStr = localStorage.getItem(SESSION_EXPIRY_KEY);
      const integrityHash = localStorage.getItem('session_integrity');
      
      if (!token || !playerId || !expiryStr || !integrityHash) {
        return null;
      }

      if (!this.validateTokenFormat(token)) {
        logError("Invalid token format detected, clearing session");
        this.clearSession();
        return null;
      }

      const expectedHash = this.generateIntegrityHash(token, playerId);
      if (integrityHash !== expectedHash) {
        logError("Session integrity check failed, clearing session");
        this.clearSession();
        return null;
      }
      
      const expiry = parseInt(expiryStr, 10);
      const now = Date.now();
      
      // Check if session is expired
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

    const expiry = Date.now() + SESSION_DURATION_MS;
    const session: SessionData = { token, playerId, expiry };
    const integrityHash = this.generateIntegrityHash(token, playerId);

    if (typeof window === 'undefined') {
      return session;
    }

    try {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      localStorage.setItem(PLAYER_ID_KEY, playerId);
      localStorage.setItem(SESSION_EXPIRY_KEY, expiry.toString());
      localStorage.setItem('session_integrity', integrityHash);
    } catch (error) {
      logError("Error saving session to localStorage:", error);
    }

    return session;
  }

  static updateSessionExpiry(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const session = this.getSession();
      if (!session) return false;
      
      const newExpiry = Date.now() + SESSION_DURATION_MS;
      localStorage.setItem(SESSION_EXPIRY_KEY, newExpiry.toString());
      return true;
    } catch (error) {
      logError("Error updating session expiry:", error);
      return false;
    }
  }

  static clearSession(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(PLAYER_ID_KEY);
      localStorage.removeItem(SESSION_EXPIRY_KEY);
      localStorage.removeItem('session_integrity');
    } catch (error) {
      logError("Error clearing session from localStorage:", error);
    }
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