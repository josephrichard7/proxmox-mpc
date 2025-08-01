/**
 * Jest Configuration for Observability Tests
 * Optimized settings for comprehensive TDD test suite
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Roots for test discovery
  roots: ['<rootDir>'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Coverage configuration
  collectCoverageFrom: [
    '../**/*.ts',
    '!../**/*.d.ts',
    '!../**/__tests__/**',
    '!../index.ts'
  ],
  
  // Coverage thresholds - aim for high coverage in observability
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Test timeout (increased for performance tests)
  testTimeout: 30000,
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/setup.js'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output for detailed test results
  verbose: true,
  
  // Max concurrent workers (optimize for CI/local)
  maxWorkers: '50%',
  
  // Module path mapping for easier imports
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../$1'
  }
};