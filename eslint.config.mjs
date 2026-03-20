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
        console: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",   // Highlights variables you defined but didn't use
      "no-undef": "error",        // Stops the build if you use an unknown variable (typo)
      "no-extra-semi": "error",   // Keeps the code clean from double semicolons
    },
  },
];