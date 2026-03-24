/**
 * utils.gs
 * Contains shared constants and helper functions used across the project.
 * @module Utils
 */

/**
 * Configuration object containing string markers for elevated data.
 * @constant {Object}
 * @property {string} MARKER - The boundary string for elevated data.
 * @property {string} FULL_MARKER - The boundary string padded with newlines.
 */
const CONFIG = {
  MARKER: "--- ELEVATED DATA ---",
  FULL_MARKER: "\n\n--- ELEVATED DATA ---\n"
};

/**
 * Extracts and parses the JSON metadata object from a task's notes string.
 * * @param {string} notes - The raw notes string from a Google Task.
 * @returns {Object} The parsed metadata object, or an empty object if no metadata is found or parsing fails.
 */
function parseMetadata(notes) {
  if (!notes || !notes.includes(CONFIG.MARKER)) return {};
  try {
    const parts = notes.split(CONFIG.MARKER);
    return JSON.parse(parts[1].trim());
  } catch (err) {
    console.error("Metadata parsing failed:", err.message);
    return {};
  }
}

/**
 * Strips out the hidden metadata block to return only the human-written notes.
 * * @param {string} notes - The raw notes string from a Google Task containing both notes and metadata.
 * @returns {string} The clean, human-readable portion of the notes.
 */
function getCleanNotes(notes) {
  if (!notes || !notes.includes(CONFIG.MARKER)) return notes || "";
  return notes.split(CONFIG.MARKER)[0].trim();
}

/**
 * Combines human-readable notes with the JSON metadata object into a single string 
 * formatted for saving to Google Tasks.
 * * @param {string} userNotes - The human-written notes.
 * @param {Object} metadataObj - The JavaScript object containing elevated task data (status, priority, etc.).
 * @returns {string} The combined string ready to be saved to the Task's notes field.
 */
function buildElevatedNotes(userNotes, metadataObj) {
  const safeNotes = userNotes || "";
  return safeNotes + CONFIG.FULL_MARKER + JSON.stringify(metadataObj, null, 2);
}

/**
 * Helper function to include HTML/CSS/JS files inside other HTML files.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}