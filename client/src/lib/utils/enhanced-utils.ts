/**
 * Enhanced utility functions with improved error handling, type safety, and performance.
 * These utilities provide common functionality used throughout the application.
 */

import { logError, logWarn, logInfo } from './logger';

// Type guards for common JavaScript types
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && Number.isFinite(value);
}

export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (isString(value) || isArray(value) || isObject(value)) {
    return Object.keys(value).length === 0;
  }
  return false;
}

// Type guards for specific domain types
export function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

// Utility functions for safer object operations
export function getSafeProperty<T = unknown>(
  obj: Record<string, unknown>, 
  key: string, 
  defaultValue?: T
): T | undefined {
  try {
    if (obj && key in obj) {
      return obj[key] as T;
    }
    return defaultValue;
  } catch (error) {
    logError(`Error accessing property '${key}' on object:`, error);
    return defaultValue;
  }
}

export function setSafeProperty<T = unknown>(
  obj: Record<string, unknown>, 
  key: string, 
  value: T,
  validate?: (value: T) => boolean
): void {
  try {
    if (validate && !validate(value)) {
      logError(`Invalid value for property '${key}':`, value);
      return;
    }
    obj[key] = value;
  } catch (error) {
    logError(`Error setting property '${key}' on object:`, error);
  }
}

// Array utilities
export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function removeDuplicates<T>(arr: T[], keyFn?: (item: T) => unknown): T[] {
  if (!keyFn) {
    return unique(arr);
  }
  
  const seen = new Set<unknown>();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function groupBy<T>(arr: T[], keyFn: (item: T) => unknown): Record<string, T[]> {
  return arr.reduce((groups, item) => {
    const key = String(keyFn(item));
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

// Function utilities
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let result: unknown;

  return function(this: unknown, ...args: Parameters<T>) {
    const context = this;
    
    const later = () => {
      timeoutId = null;
      if (!immediate) {
        result = func.apply(context, args);
      }
    };

    const callNow = immediate && !timeoutId;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(later, wait);
    
    if (callNow) {
      result = func.apply(context, args);
    }
    
    return result;
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function(this: unknown, ...args: Parameters<T>) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Error handling utilities
export function createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause) {
    error.cause = cause;
  }
  return error;
}

export function isNetworkError(error: unknown): error is Error {
  return error instanceof Error && (
    error.message.includes('Network') ||
    error.message.includes('Connection') ||
    error.message.includes('fetch') ||
    error.message.includes('WebSocket')
  );
}

export function isTimeoutError(error: unknown): error is Error {
  return error instanceof Error && (
    error.message.includes('Timeout') ||
    error.message.includes('ETIMEDOUT') ||
    error.message.includes('TIMEOUT')
  );
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Performance monitoring utilities
export function measurePerformance<T>(
  name: string,
  fn: () => T,
  threshold: number = 100
): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const duration = end - start;
  
  if (duration > threshold) {
    logWarn(`Performance threshold exceeded: ${name} took ${duration.toFixed(2)}ms`);
  }
  
  return result;
}

// Validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateHexColor(color: string): boolean {
  return /^#([0-9A-F]{3}){1,2}$/i.test(color);
}

// Async utilities
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const attempt = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(error);
        } else {
          logWarn(`Attempt ${attempts} failed, retrying...`, error);
          setTimeout(attempt, delay);
        }
      }
    };
    
    attempt();
  });
}

// Object utilities
export function deepClone<T>(obj: T): T {
  try {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as T;
    }
    
    if (obj instanceof Array) {
      return obj.map(item => deepClone(item)) as T;
    }
    
    if (obj instanceof RegExp) {
      return new RegExp(obj.source, obj.flags) as T;
    }
    
    const cloned = {} as Record<string, unknown>;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned as T;
  } catch (error) {
    logError('Error during deep clone:', error);
    throw createError('Failed to clone object', error);
  }
}

export function pick<T extends object, K extends keyof T>(
  obj: T, 
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

export function omit<T extends object, K extends keyof T>(
  obj: T, 
  keys: K[]
): Omit<T, K> {
  const result = { ...obj } as Omit<T, K>;
  keys.forEach(key => {
    delete result[key];
  });
  return result;
}

// String utilities
export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Number utilities
export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Date utilities
export function formatDate(date: Date | string, format: string = 'short'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    logError('Invalid date provided for formatting:', date);
    return 'Invalid Date';
  }
  
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: format as 'short' | 'medium' | 'long' | 'full',
    timeStyle: format === 'short' ? 'short' : 'medium',
  }).format(dateObj);
}

export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    logError('Invalid date provided for relative formatting:', date);
    return 'Invalid Date';
  }
  
  const now = new Date();
  const diff = dateObj.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  
  if (absDiff < 1000) return 'just now';
  if (absDiff < 60000) return `${Math.floor(absDiff / 1000)} seconds ago`;
  if (absDiff < 3600000) return `${Math.floor(absDiff / 60000)} minutes ago`;
  if (absDiff < 86400000) return `${Math.floor(absDiff / 3600000)} hours ago`;
  if (absDiff < 2592000000) return `${Math.floor(absDiff / 86400000)} days ago`;
  
  return formatDate(dateObj);
}

// Utility for safe JSON operations
export function safeJSONParse<T = unknown>(str: string, defaultValue?: T): T | undefined {
  try {
    return JSON.parse(str) as T;
  } catch (error) {
    logError('Error parsing JSON:', error);
    return defaultValue;
  }
}

export function safeJSONStringify<T>(obj: T, indent?: number): string {
  try {
    return JSON.stringify(obj, null, indent);
  } catch (error) {
    logError('Error stringifying JSON:', error);
    return '{}';
  }
}

// Export all type guards as a single object for easier import
export const TypeGuards = {
  isString,
  isNumber,
  isInteger,
  isBoolean,
  isObject,
  isArray,
  isFunction,
  isDate,
  isEmpty,
  isPositiveInteger,
  isNonNegativeInteger,
  isPositiveNumber,
  isNonNegativeNumber,
};

// Export all utility functions as a single object for easier import
export const Utils = {
  getSafeProperty,
  setSafeProperty,
  unique,
  removeDuplicates,
  groupBy,
  debounce,
  throttle,
  createError,
  isNetworkError,
  isTimeoutError,
  isError,
  measurePerformance,
  validateEmail,
  validateUrl,
  validateHexColor,
  sleep,
  retry,
  deepClone,
  pick,
  omit,
  truncate,
  capitalize,
  formatBytes,
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDate,
  formatRelativeTime,
  safeJSONParse,
  safeJSONStringify,
};