import { SESSION_TOKEN_KEY, PLAYER_ID_KEY, SESSION_EXPIRY_KEY } from "@/lib/constants/storage";
import { logError } from "@/lib/utils/logger";

// Session expiry (30 minutes as per architecture)
const SESSION_DURATION_MS = 30 * 60 * 1000;

export interface SessionData {
  token: string;
  playerId: string;
  expiry: number; // Unix timestamp in milliseconds
}

export class SessionManager {
  static getSession(): SessionData | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      const playerId = localStorage.getItem(PLAYER_ID_KEY);
      const expiryStr = localStorage.getItem(SESSION_EXPIRY_KEY);
      
      if (!token || !playerId || !expiryStr) {
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
    const expiry = Date.now() + SESSION_DURATION_MS;
    const session: SessionData = { token, playerId, expiry };

    if (typeof window === 'undefined') {
      return session;
    }

    try {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      localStorage.setItem(PLAYER_ID_KEY, playerId);
      localStorage.setItem(SESSION_EXPIRY_KEY, expiry.toString());
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
    try {
      if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
      }
    } catch (_error) {
      // Fallback to manual generation if crypto API fails
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}