// @ts-check

const CONFIG = {
  DELIMITER: "|||" 
};

/**
 * @typedef {Object} TaskMetadata
 * @property {string} status
 * @property {string} priority
 * @property {string} project
 * @property {string} assignee
 * @property {string} type
 * @property {string} blocked_by
 * @property {string} [start_date]
 * @property {string} [due_date]
 */

/**
 * Extracts and parses the JSON metadata object from the top of the notes string.
 * @param {string} rawNotes 
 * @returns {TaskMetadata}
 */
function parseMetadata(rawNotes) {
  const defaultMetadata = { status: 'open', priority: 'medium', project: '', assignee: '', type: 'general', blocked_by: '' };
  
  if (!rawNotes) return defaultMetadata;

  try {
    const parts = rawNotes.split(CONFIG.DELIMITER);
    const parsedData = JSON.parse(parts[0].trim());
    return { ...defaultMetadata, ...parsedData };
  } catch (err) {
    // @ts-ignore
    console.warn("Failed to parse metadata" + err.message);
    return defaultMetadata;
  }
}

/**
 * Strips out the hidden metadata block to return only the human-written notes.
 * @param {string} rawNotes 
 * @returns {string}
 */
function getCleanNotes(rawNotes) {
  if (!rawNotes || !rawNotes.includes(CONFIG.DELIMITER)) return rawNotes || "";
  const parts = rawNotes.split(CONFIG.DELIMITER);
  return parts.length > 1 ? parts.slice(1).join(CONFIG.DELIMITER).trim() : "";
}

/**
 * Combines JSON metadata and human notes safely.
 * @param {string} userNotes 
 * @param {Partial<TaskMetadata>} metadataObj 
 * @returns {string}
 */
function buildElevatedNotes(userNotes, metadataObj) {
  const cleanObj = Object.fromEntries(
    Object.entries(metadataObj).filter(([_, v]) => v != null && v !== '')
  );
  
  const jsonString = JSON.stringify(cleanObj);
  const safeNotes = userNotes || "";
  
  if (!safeNotes.trim()) return jsonString;
  return `${jsonString} ${CONFIG.DELIMITER}\n\n${safeNotes.trim()}`;
}

/**
 * Helper function to include HTML/CSS/JS files inside other HTML files.
 * @param {string} filename 
 * @returns {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * @typedef {Object} WorkspaceUser
 * @property {string} email
 * @property {string} name
 */

/**
 * Fetches all active users in the Google Workspace directory.
 * @returns {WorkspaceUser[]}
 */
function getWorkspaceUsers() {
  /** @type {WorkspaceUser[]} */
  const users = [];
  
  try {
    let pageToken;
    do {
      // @ts-ignore - AdminDirectory is an advanced service, types can be finicky
      const response = AdminDirectory.Users.list({
        customer: 'my_customer',
        maxResults: 100,
        query: "isSuspended=false",
        pageToken: pageToken
      });

      if (response.users) {
        response.users.forEach((/** @type {{ primaryEmail: any; name: { fullName: any; }; }} */ user) => {
          users.push({
            email: user.primaryEmail,
            name: user.name.fullName
          });
        });
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

  } catch (err) {
    // @ts-ignore
    console.warn("Could not fetch Workspace directory: " + err.message);
    const myEmail = Session.getActiveUser().getEmail();
    users.push({
      email: myEmail,
      name: myEmail.split('@')[0]
    });
  }
  
  return users;
}

if (typeof module !== 'undefined') {
  module.exports = {
    parseMetadata,
    getCleanNotes,
    buildElevatedNotes,
    include,
    getWorkspaceUsers
  };
}