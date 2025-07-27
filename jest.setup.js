/**
 * Jest setup file to configure environment variables and test utilities
 */

// Load environment variables from .env file
require('dotenv').config();

// Set test-specific database URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./test.db";
}

// Set NODE_ENV for tests
process.env.NODE_ENV = "test";

// Set other test environment variables
process.env.LOG_LEVEL = "error"; // Reduce log noise in tests