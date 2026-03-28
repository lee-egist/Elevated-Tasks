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
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },

  // Environment setup
  testEnvironment: "node",
  transform: {} // Not needed unless using Babel/TypeScript
};

module.exports = config;