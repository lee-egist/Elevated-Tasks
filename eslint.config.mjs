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
        ScriptApp: "readonly",
        CardService: "readonly",
        Tasks: "readonly",
        console: "readonly",

        // --- Add your Custom Global Functions here ---
        // If Code.js calls a function defined in api.js, 
        // add the function name here so ESLint knows it exists.
        fetchAllTaskLists: "writable",
        buildDashboardCard: "writable",
        buildTaskCard: "writable",
        fetchAndLinkTasks: "writable",
        fetchExistingProjects: "writable",
        getWorkspaceUsers: "writable",
        insertTask: "writable",
        createElevatedTask: "writable",
        getTask: "writable",
        parseMetadata: "writable",
        updateTaskData: "writable",
        buildElevatedNotes: "writable",
        getCleanNotes: "writable",
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