// @ts-check
import js from "@eslint/js";
import jestPlugin from "eslint-plugin-jest";
import globals from "globals";
import gas from "eslint-plugin-googleappsscript";

export default [
  // 1. Base Configuration for all files
  js.configs.recommended,
  {
    files: ["src/**/*.js", "src/**/*.gs"],
    plugins: {
      googleappsscript: gas,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.node,
        // Pulls in SpreadsheetApp, DriveApp, Logger, etc.
        ...gas.environments.googleappsscript.globals,

        // --- Custom Global Functions (Cross-file communication) ---
        // UI & Handlers
        buildDashboardCard: "writable",
        buildTaskCard: "writable",
        getWorkspaceUsers: "writable",
        isValidUUID: "writable",
        createNewProject: "writable",
        ensureCurrentUserProfile: "writable",
        
        // Supabase Database API
        dbCreateTask: "writable",
        dbDeleteTask: "writable",
        dbGetTasks: "writable",
        dbUpdateTask: "writable",
        dbGetProjects: "writable",
        dbCreateProject: "writable",
        dbCreateProfile: "writable",
        dbCheckMyProfile: "writable",
        dbInviteTeammate: "writable",
        dbUpdateProfile: "writable",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "vars": "local", "args": "none" }],
      "no-undef": "error",
      "no-extra-semi": "error",
      "no-redeclare": "off",
    },
  },

  // 2. Specialized Configuration for Jest Test Files
  {
    files: ["src/**/*.test.js", "src/**/*.spec.js"],
    plugins: {
      jest: jestPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.jest, // Adds describe, test, expect, etc.
      },
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
      "jest/no-disabled-tests": "warn",
      "jest/no-focused-tests": "error",
      "no-unused-vars": "off", // Often tests have unused setup vars
    },
  },
];