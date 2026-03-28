// @ts-check
/** @type {import('jest').Config} */
const config = {
  verbose: true,
  // Tells Jest to look for tests in the src or tests folder
  testMatch: ["**/tests/**/*.test.js", "**/*.test.js"],
  
  // 🛡️ CRITICAL: Enforcement for 100% Coverage
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.{js,gs}", // Include your Apps Script files
    "!**/node_modules/**",
    "!**/tests/**"
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 100,
      lines: 95,
      statements: 100
    }
  },

  // Environment setup
  testEnvironment: "node",
  transform: {} // Not needed unless using Babel/TypeScript
};

module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.{js,gs}",
    "!src/tests/**",        // Don't measure coverage of the tests themselves
    "!**/node_modules/**"
  ],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100
    }
  },
  testEnvironment: "node",
  // This helps Jest handle the fact that GAS files sometimes don't have extensions
  moduleFileExtensions: ["js", "gs", "json"]
};