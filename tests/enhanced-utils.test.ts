/**
 * Comprehensive test suite for enhanced utilities and error handling.
 * This file contains tests for all the new functionality added to improve code quality.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  TypeGuards, 
  Utils, 
  createError, 
  isNetworkError, 
  isTimeoutError, 
  isError,
  debounce,
  throttle,
  sleep,
  retry,
  unique,
  removeDuplicates,
  groupBy,
  pick,
  omit,
  formatBytes,
  formatCurrency,
  formatDate,
  truncate,
  capitalize,
  validateEmail,
  validateUrl,
  validateHexColor,
  deepClone,
} from '@/lib/utils/enhanced-utils';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

describe('Type Guards', () => {
  describe('String type guards', () => {
    it('should correctly identify strings', () => {
      expect(TypeGuards.isString('hello')).toBe(true);
      expect(TypeGuards.isString(123)).toBe(false);
      expect(TypeGuards.isString(null)).toBe(false);
      expect(TypeGuards.isString(undefined)).toBe(false);
      expect(TypeGuards.isString({})).toBe(false);
    });
  });

  describe('Number type guards', () => {
    it('should correctly identify numbers', () => {
      expect(TypeGuards.isNumber(123)).toBe(true);
      expect(TypeGuards.isNumber(123.45)).toBe(true);
      expect(TypeGuards.isNumber('123')).toBe(false);
      expect(TypeGuards.isNumber(null)).toBe(false);
      expect(TypeGuards.isNumber(NaN)).toBe(false);
      expect(TypeGuards.isNumber(Infinity)).toBe(false);
    });
  });

  describe('Integer type guards', () => {
    it('should correctly identify integers', () => {
      expect(TypeGuards.isInteger(123)).toBe(true);
      expect(TypeGuards.isInteger(-456)).toBe(true);
      expect(TypeGuards.isInteger(123.45)).toBe(false);
      expect(TypeGuards.isInteger('123')).toBe(false);
    });
  });

  describe('Boolean type guards', () => {
    it('should correctly identify booleans', () => {
      expect(TypeGuards.isBoolean(true)).toBe(true);
      expect(TypeGuards.isBoolean(false)).toBe(true);
      expect(TypeGuards.isBoolean(1)).toBe(false);
      expect(TypeGuards.isBoolean(0)).toBe(false);
      expect(TypeGuards.isBoolean('true')).toBe(false);
    });
  });

  describe('Object type guards', () => {
    it('should correctly identify objects', () => {
      expect(TypeGuards.isObject({})).toBe(true);
      expect(TypeGuards.isObject({ key: 'value' })).toBe(true);
      expect(TypeGuards.isObject(null)).toBe(false);
      expect(TypeGuards.isObject(undefined)).toBe(false);
      expect(TypeGuards.isObject([1, 2, 3])).toBe(false);
      expect(TypeGuards.isObject('string')).toBe(false);
    });
  });

  describe('Array type guards', () => {
    it('should correctly identify arrays', () => {
      expect(TypeGuards.isArray([])).toBe(true);
      expect(TypeGuards.isArray([1, 2, 3])).toBe(true);
      expect(TypeGuards.isArray({})).toBe(false);
      expect(TypeGuards.isArray(null)).toBe(false);
      expect(TypeGuards.isArray(undefined)).toBe(false);
    });
  });

  describe('Positive number guards', () => {
    it('should correctly identify positive integers', () => {
      expect(TypeGuards.isPositiveInteger(123)).toBe(true);
      expect(TypeGuards.isPositiveInteger(0)).toBe(false);
      expect(TypeGuards.isPositiveInteger(-123)).toBe(false);
      expect(TypeGuards.isPositiveInteger(123.45)).toBe(false);
    });

    it('should correctly identify positive numbers', () => {
      expect(TypeGuards.isPositiveNumber(123.45)).toBe(true);
      expect(TypeGuards.isPositiveNumber(0)).toBe(false);
      expect(TypeGuards.isPositiveNumber(-123)).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  describe('getSafeProperty', () => {
    it('should safely get properties from objects', () => {
      const obj = { a: 1, b: 2, c: { d: 3 } };
      
      expect(Utils.getSafeProperty(obj, 'a')).toBe(1);
      expect(Utils.getSafeProperty(obj, 'b')).toBe(2);
      expect(Utils.getSafeProperty(obj, 'c')).toEqual({ d: 3 });
      expect(Utils.getSafeProperty(obj, 'nonexistent')).toBeUndefined();
      expect(Utils.getSafeProperty(obj, 'nonexistent', 'default')).toBe('default');
      
      // Test with invalid object
      expect(Utils.getSafeProperty(null as any, 'a')).toBeUndefined();
    });
  });

  describe('setSafeProperty', () => {
    it('should safely set properties on objects', () => {
      const obj: any = {};
      
      Utils.setSafeProperty(obj, 'a', 1);
      expect(obj.a).toBe(1);
      
      Utils.setSafeProperty(obj, 'b', 'hello');
      expect(obj.b).toBe('hello');
      
      // Test validation
      Utils.setSafeProperty(obj, 'c', 123, (value) => value > 100);
      expect(obj.c).toBe(123);
      
      Utils.setSafeProperty(obj, 'd', 50, (value) => value > 100);
      expect(obj.d).toBeUndefined();
    });
  });

  describe('Array utilities', () => {
    describe('unique', () => {
      it('should remove duplicates from arrays', () => {
        const arr = [1, 2, 2, 3, 4, 4, 5];
        expect(unique(arr)).toEqual([1, 2, 3, 4, 5]);
      });
    });

    describe('removeDuplicates', () => {
      it('should remove duplicates using key function', () => {
        const arr = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 1, name: 'c' }];
        const result = removeDuplicates(arr, item => item.id);
        expect(result).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
      });
    });

    describe('groupBy', () => {
      it('should group array items by key function', () => {
        const arr = [{ type: 'a', value: 1 }, { type: 'b', value: 2 }, { type: 'a', value: 3 }];
        const result = groupBy(arr, item => item.type);
        expect(result).toEqual({
          a: [{ type: 'a', value: 1 }, { type: 'a', value: 3 }],
          b: [{ type: 'b', value: 2 }],
        });
      });
    });
  });

  describe('Function utilities', () => {
    describe('debounce', () => {
      it('should debounce function calls', (done) => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);
        
        debouncedFn();
        debouncedFn();
        debouncedFn();
        
        expect(mockFn).not.toHaveBeenCalled();
        
        setTimeout(() => {
          expect(mockFn).toHaveBeenCalledTimes(1);
          done();
        }, 150);
      });

      it('should call immediately with immediate flag', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100, true);
        
        debouncedFn();
        expect(mockFn).toHaveBeenCalledTimes(1);
      });
    });

    describe('throttle', () => {
      it('should throttle function calls', (done) => {
        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 100);
        
        throttledFn();
        throttledFn();
        throttledFn();
        
        expect(mockFn).toHaveBeenCalledTimes(1);
        
        setTimeout(() => {
          throttledFn();
          expect(mockFn).toHaveBeenCalledTimes(2);
          done();
        }, 150);
      });
    });
  });

  describe('Error utilities', () => {
    describe('createError', () => {
      it('should create errors with cause', () => {
        const cause = new Error('Original error');
        const error = createError('New error', cause);
        
        expect(error.message).toBe('New error');
        expect(error.cause).toBe(cause);
      });
    });

    describe('Error type detection', () => {
      it('should detect network errors', () => {
        const networkError = new Error('Network Error');
        expect(isNetworkError(networkError)).toBe(true);
        
        const regularError = new Error('Regular error');
        expect(isNetworkError(regularError)).toBe(false);
      });

      it('should detect timeout errors', () => {
        const timeoutError = new Error('Timeout Error');
        expect(isTimeoutError(timeoutError)).toBe(true;
        
        const regularError = new Error('Regular error');
        expect(isTimeoutError(regularError)).toBe(false);
      });

      it('should detect general errors', () => {
        const error = new Error('Test error');
        expect(isError(error)).toBe(true);
        
        expect(isError('not an error')).toBe(false);
        expect(isError(null)).toBe(false);
        expect(isError(undefined)).toBe(false);
      });
    });
  });

  describe('Validation utilities', () => {
    describe('validateEmail', () => {
      it('should validate email addresses', () => {
        expect(validateEmail('test@example.com')).toBe(true);
        expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
        expect(validateEmail('invalid-email')).toBe(false);
        expect(validateEmail('@domain.com')).toBe(false);
        expect(validateEmail('user@')).toBe(false);
      });
    });

    describe('validateUrl', () => {
      it('should validate URLs', () => {
        expect(validateUrl('https://example.com')).toBe(true);
        expect(validateUrl('http://localhost:3000')).toBe(true);
        expect(validateUrl('ftp://example.com')).toBe(true);
        expect(validateUrl('not-a-url')).toBe(false);
        expect(validateUrl('://invalid.com')).toBe(false);
      });
    });

    describe('validateHexColor', () => {
      it('should validate hex colors', () => {
        expect(validateHexColor('#000000')).toBe(true);
        expect(validateHexColor('#FFFFFF')).toBe(true);
        expect(validateHexColor('#abc')).toBe(true);
        expect(validateHexColor('#abcdef')).toBe(true);
        expect(validateHexColor('#ghijkl')).toBe(false);
        expect(validateHexColor('000000')).toBe(false);
      });
    });
  });

  describe('Async utilities', () => {
    describe('sleep', () => {
      it('should sleep for specified time', async () => {
        const start = Date.now();
        await sleep(100);
        const end = Date.now();
        expect(end - start).toBeGreaterThanOrEqual(100);
      });
    });

    describe('retry', () => {
      it('should retry failed operations', async () => {
        let attempts = 0;
        const mockFn = jest.fn()
          .mockRejectedValueOnce(new Error('First failure'))
          .mockResolvedValueOnce('Success');
        
        const result = await retry(mockFn, 3, 10);
        expect(result).toBe('Success');
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('should fail after max attempts', async () => {
        const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));
        
        await expect(retry(mockFn, 2, 10)).rejects.toThrow('Always fails');
        expect(mockFn).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Object utilities', () => {
    describe('deepClone', () => {
      it('should deep clone objects', () => {
        const original = {
          a: 1,
          b: { c: 2, d: [3, 4] },
          e: new Date(),
          f: /test/,
        };
        
        const cloned = deepClone(original);
        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.b).not.toBe(original.b);
        expect(cloned.b.d).not.toBe(original.b.d);
      });
    });

    describe('pick', () => {
      it('should pick specified properties', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
      });
    });

    describe('omit', () => {
      it('should omit specified properties', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
      });
    });
  });

  describe('String utilities', () => {
    describe('truncate', () => {
      it('should truncate strings', () => {
        expect(truncate('Hello world', 5)).toBe('Hello...');
        expect(truncate('Hi', 5)).toBe('Hi');
        expect(truncate('Hello world', 20)).toBe('Hello world');
      });
    });

    describe('capitalize', () => {
      it('should capitalize strings', () => {
        expect(capitalize('hello')).toBe('Hello');
        expect(capitalize('HELLO')).toBe('Hello');
        expect(capitalize('')).toBe('');
        expect(capitalize('a')).toBe('A');
      });
    });
  });

  describe('Number utilities', () => {
    describe('formatBytes', () => {
      it('should format bytes', () => {
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1024 * 1024)).toBe('1 MB');
        expect(formatBytes(0)).toBe('0 Bytes');
        expect(formatBytes(1500)).toBe('1.46 KB');
      });
    });

    describe('formatCurrency', () => {
      it('should format currency', () => {
        expect(formatCurrency(1000)).toBe('$1,000.00');
        expect(formatCurrency(50, 'EUR')).toBe('€50.00');
      });
    });

    describe('formatDate', () => {
      it('should format dates', () => {
        const date = new Date('2023-01-01T00:00:00.000Z');
        expect(formatDate(date)).toBe('1/1/23');
      });
    });
  });

  describe('JSON utilities', () => {
    describe('safeJSONParse', () => {
      it('should safely parse JSON', () => {
        expect(Utils.safeJSONParse('{"a": 1}')).toEqual({ a: 1 });
        expect(Utils.safeJSONParse('invalid', { default: true })).toBe(true);
      });
    });

    describe('safeJSONStringify', () => {
      it('should safely stringify JSON', () => {
        expect(Utils.safeJSONStringify({ a: 1 })).toBe('{"a":1}');
        expect(Utils.safeJSONStringify(() => {})).toBe('{}');
      });
    });
  });
});

describe('Error Handling Integration', () => {
  describe('Error handling flow', () => {
    it('should handle network errors gracefully', () => {
      const networkError = new Error('Network failed');
      const error = createError('Request failed', networkError);
      
      expect(error.message).toBe('Request failed');
      expect(error.cause).toBe(networkError);
      expect(isNetworkError(error)).toBe(true);
    });

    it('should handle timeout errors gracefully', () => {
      const timeoutError = new Error('Request timeout');
      const error = createError('Request timed out', timeoutError);
      
      expect(error.message).toBe('Request timed out');
      expect(isTimeoutError(error)).toBe(true);
    });

    it('should handle validation errors gracefully', () => {
      const error = createError('Invalid input', undefined, 'ValidationError');
      
      expect(error.message).toBe('Invalid input');
      expect(isError(error)).toBe(true);
    });
  });

  describe('Error recovery', () => {
    it('should retry operations with exponential backoff', async () => {
      let attempts = 0;
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt'))
        .mockResolvedValueOnce('Success');
      
      const result = await retry(mockFn, 3, 10);
      expect(result).toBe('Success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should provide fallback operations', () => {
      const mockOperation = jest.fn().mockImplementation(() => {
        throw new Error('Operation failed');
      });
      const mockFallback = jest.fn().mockReturnValue('fallback');
      
      const result = Utils.fallbackOperation(mockOperation, mockFallback);
      expect(result).toBe('fallback');
      expect(mockOperation).toHaveBeenCalled();
      expect(mockFallback).toHaveBeenCalled();
    });
  });
});

describe('Performance Monitoring', () => {
  describe('Performance tracking', () => {
    it('should track custom metrics', () => {
      const mockTrackMetric = jest.fn();
      const originalTrack = globalPerformanceMonitor.trackCustomMetric;
      globalPerformanceMonitor.trackCustomMetric = mockTrackMetric;
      
      Utils.measurePerformance(() => {
        // Do some work
        return 'result';
      }, 'test operation');
      
      expect(mockTrackMetric).toHaveBeenCalledWith(
        'test operation execution time',
        expect.any(Number),
        'ms',
        { method: 'test operation' }
      );
      
      globalPerformanceMonitor.trackCustomMetric = originalTrack;
    });
  });
});

describe('Edge Cases and Error Scenarios', () => {
  describe('Empty and null values', () => {
    it('should handle null and undefined values', () => {
      expect(TypeGuards.isEmpty(null)).toBe(true);
      expect(TypeGuards.isEmpty(undefined)).toBe(true);
      expect(TypeGuards.isEmpty('')).toBe(true);
      expect(TypeGuards.isEmpty([])).toBe(true);
      expect(TypeGuards.isEmpty({})).toBe(true);
      expect(TypeGuards.isEmpty(0)).toBe(false);
    });
  });

  describe('Circular references', () => {
    it('should handle circular references in deep clone', () => {
      const obj: any = { a: 1 };
      obj.b = obj; // Circular reference
      
      expect(() => deepClone(obj)).toThrow();
    });
  });

  describe('Invalid JSON', () => {
    it('should handle invalid JSON parsing', () => {
      expect(Utils.safeJSONParse('invalid json')).toBeUndefined();
      expect(Utils.safeJSONParse('invalid json', { default: true })).toBe(true);
    });
  });

  describe('Memory usage', () => {
    it('should handle large objects efficiently', () => {
      const largeArray = Array(10000).fill(0);
      const start = performance.now();
      
      const result = unique(largeArray);
      const end = performance.now();
      
      expect(result.length).toBe(1);
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });
  });
});

describe('Integration Tests', () => {
  describe('Complete error handling flow', () => {
    it('should handle complex error scenarios', async () => {
      // Simulate a network request that fails and recovers
      let attempts = 0;
      const mockNetworkRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout error'))
        .mockResolvedValueOnce('Data received');
      
      const result = await retry(mockNetworkRequest, 3, 50);
      expect(result).toBe('Data received');
      expect(mockNetworkRequest).toHaveBeenCalledTimes(3);
    });

    it('should handle validation chain', () => {
      const data = {
        email: 'invalid-email',
        url: 'not-a-url',
        color: '#invalid',
        amount: -100,
      };
      
      // Test validation functions
      expect(validateEmail(data.email)).toBe(false);
      expect(validateUrl(data.url)).toBe(false);
      expect(validateHexColor(data.color)).toBe(false);
      expect(TypeGuards.isPositiveInteger(data.amount)).toBe(false);
    });

    it('should handle complex object operations', () => {
      const data = [
        { id: 1, category: 'a', value: 10 },
        { id: 2, category: 'b', value: 20 },
        { id: 3, category: 'a', value: 30 },
        { id: 1, category: 'c', value: 40 }, // Duplicate ID
      ];
      
      const uniqueById = removeDuplicates(data, item => item.id);
      const grouped = groupBy(data, item => item.category);
      const picked = pick(data[0], ['id', 'value']);
      
      expect(uniqueById).toHaveLength(3);
      expect(grouped).toHaveProperty('a');
      expect(grouped).toHaveProperty('b');
      expect(grouped).toHaveProperty('c');
      expect(picked).toEqual({ id: 1, value: 10 });
    });
});

describe('Performance Benchmarks', () => {
  describe('Performance critical operations', () => {
    it('should handle array operations quickly', () => {
      const largeArray = Array(10000).fill(0).map((_, i) => i);
      
      const start = performance.now();
      const result = unique(largeArray);
      const end = performance.now();
      
      expect(result.length).toBe(10000);
      expect(end - start).toBeLessThan(50); // Should complete in under 50ms
    });

    it('should handle object operations efficiently', () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }
      
      const start = performance.now();
      const picked = pick(largeObject, ['key1', 'key2', 'key3']);
      const end = performance.now();
      
      expect(Object.keys(picked)).toHaveLength(3);
      expect(end - start).toBeLessThan(10); // Should complete in under 10ms
    });

    it('should handle string operations efficiently', () => {
      const longString = 'a'.repeat(1000);
      
      const start = performance.now();
      const result = truncate(longString, 100);
      const end = performance.now();
      
      expect(result.length).toBeLessThanOrEqual(103); // 100 chars + '...'
      expect(end - start).toBeLessThan(1); // Should complete in under 1ms
    });
  });
});

// After all tests
afterEach(() => {
  jest.clearAllMocks();
});

// Test the complete integration of all utilities
describe('Complete Integration', () => {
  it('should work together seamlessly', () => {
    // Create a complex data structure
    const data = {
      user: {
        id: 1,
        email: 'test@example.com',
        profile: {
          name: 'Test User',
          preferences: {
            theme: 'dark',
            language: 'en',
          },
        },
      },
      settings: {
        notifications: true,
        privacy: {
          public: false,
          friends: true,
        },
      },
    };

    // Use various utilities together
    const cloned = deepClone(data);
    const pickedUser = pick(cloned.user, ['id', 'email']);
    const userPreferences = pick(cloned.user.profile.preferences, ['theme']);
    
    // Validate results
    expect(cloned).toEqual(data);
    expect(cloned).not.toBe(data);
    expect(pickedUser).toEqual({ id: 1, email: 'test@example.com' });
    expect(userPreferences).toEqual({ theme: 'dark' });
    expect(validateEmail(pickedUser.email)).toBe(true);
  });

  it('should handle error scenarios gracefully', () => {
    // Create error scenarios
    const error = new Error('Test error');
    const networkError = new Error('Network failed');
    
    // Handle errors
    expect(isError(error)).toBe(true);
    expect(isNetworkError(networkError)).toBe(true);
    expect(isTimeoutError(error)).toBe(false);
    
    // Create error with cause
    const errorWithCause = createError('Wrapper error', networkError);
    expect(errorWithCause.cause).toBe(networkError);
  });
});