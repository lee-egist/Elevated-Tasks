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
        
        //Service Classes
        SupabaseClient: "readonly",
        ProfileService: "readonly",
        OrganizationService: "readonly",
        ProjectService: "readyonly",
        GoalService: "readonly",
        TaskService: "readonly"
        // Supabase Database API
        // dbGetMyOrganizations: "writable",
        // dbCheckMyProfile: "writable",
        // dbCreateProfile: "writable",
        // dbGetProjects: "writable",
        // dbCreateProject: "writable",
        // dbGetTasksByProject: "writable",
        // dbCreateTask: "writable",
        // dbUpdateTask: "writable",
        // dbDeleteTask: "writable",
        // dbCreateTaskSnapshot: "writable",
        // dbSaveContextThread: "writable",
        // dbLinkTaskToContext: "writable",
        // dbLogTaskRisk: "writable",
        // dbAddMitigationSuggestion: "writable",
        // dbInviteTeammate: "writable",
        // dbUpdateProfile: "writable",
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