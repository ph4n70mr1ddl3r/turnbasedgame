/** @type {import('jest').Config} */
const config = {
  // Test files pattern
  testMatch: [
    '<rootDir>/tests/component/**/*.test.tsx',
    '<rootDir>/tests/component/**/*.test.ts',
  ],

  // Test environment
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Module name mapping (for TypeScript paths)
  moduleNameMapper: {
    // Handle module aliases (if configured in tsconfig)
    '^@/(.*)$': '<rootDir>/client/src/$1',
    // Handle CSS imports (mock)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Handle image imports
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
  },

  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/client/tsconfig.json',
      },
    ],
  },

  // Coverage configuration
  collectCoverageFrom: [
    'client/src/**/*.{ts,tsx}',
    '!client/src/**/*.d.ts',
    '!client/src/**/*.stories.{ts,tsx}',
    '!client/src/**/*.test.{ts,tsx}',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/client/out/',
  ],

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],

  // Display individual test results
  verbose: true,
};

module.exports = config;