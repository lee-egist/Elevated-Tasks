import js from "@eslint/js";
import jest from "eslint-plugin-jest";
import globals from "globals"


export default [
  js.configs.recommended,
  {
    files: ["src/**/*.test.js", "src/**/*.gs"],
    plugins: {
      jest,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        ...globals.googleappsscript,
        // Essential Google Apps Script Globals
        SpreadsheetApp: "readonly",
        DriveApp: "readonly",
        DocumentApp: "readonly",
        GmailApp: "readonly",
        Session: "readonly",
        Logger: "readonly",
        HtmlService: "readonly",
        UrlFetchApp: "readonly",
        Utilities: "readonly",
        PropertiesService: "readonly",
        People: "readonly",
        ScriptApp: "readonly",
        CardService: "readonly",
        Tasks: "readonly",
        console: "readonly",
        AdminDirectory: "readonly",

        // --- Custom Global Functions ---
        // UI & Handlers
        buildDashboardCard: "writable",
        buildTaskCard: "writable",
        getWorkspaceUsers: "writable",
        isValidUUID: "writable",
        createNewProject: "writable",
        ensureCurrentUserProfile: "writable",
        
        // Supabase Database API
        // Tasks
        dbCreateTask: "writable",
        dbDeleteTask: "writable",
        dbGetTasks: "writable",
        dbUpdateTask: "writable",

        // Projects
        dbGetProjects: "writable",
        dbCreateProject: "writable",

        // Profile
        dbCreateProfile: "writable",
        dbCheckMyProfile: "writable",
        dbInviteTeammate: "writable",
        dbUpdateProfile: "writable",
        
        // (We will add dbCreateProject here shortly!)
      },
    },
    rules: {
      "no-unused-vars": ["warn", {
        "vars": "local",
        "args": "none"
      }],  // Highlights variables you defined but didn't use
      "no-undef": "error",        // Stops the build if you use an unknown variable (typo)
      "no-extra-semi": "error",   // Keeps the code clean from double semicolons
      "no-redeclare": "off",
    },
  },
];