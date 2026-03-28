import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js", "src/**/*.gs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
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