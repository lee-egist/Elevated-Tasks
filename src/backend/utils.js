/**
 * utils.js
 * Contains shared constants and helper functions used across the project.
 * Upgraded to the Bulletproof Metadata Engine.
 */

const CONFIG = {
  DELIMITER: "|||" 
};

/**
 * Extracts and parses the JSON metadata object from the top of the notes string.
 */
function parseMetadata(rawNotes) {
  const defaultMetadata = { status: 'open', priority: 'medium', project: '', assignee: '', type: 'general', blocked_by: '' };
  
  if (!rawNotes) return defaultMetadata;

  try {
    const parts = rawNotes.split(CONFIG.DELIMITER);
    const parsedData = JSON.parse(parts[0].trim());
    return { ...defaultMetadata, ...parsedData };
  } catch (err) {
    // If it fails (e.g., user deleted the JSON on their phone), return defaults
    console.warn("Failed to parse metadata" + err.message);
    return defaultMetadata;
  }
}

/**
 * Strips out the hidden metadata block to return only the human-written notes.
 */
function getCleanNotes(rawNotes) {
  if (!rawNotes || !rawNotes.includes(CONFIG.DELIMITER)) return rawNotes || "";
  
  // The human notes are everything AFTER the delimiter
  const parts = rawNotes.split(CONFIG.DELIMITER);
  return parts.length > 1 ? parts.slice(1).join(CONFIG.DELIMITER).trim() : "";
}

/**
 * Combines JSON metadata and human notes safely.
 */
function buildElevatedNotes(userNotes, metadataObj) {
  // Clean out empty properties so we don't waste character space
  const cleanObj = Object.fromEntries(
    Object.entries(metadataObj).filter(([_, v]) => v != null && v !== '')
  );
  
  const jsonString = JSON.stringify(cleanObj);
  const safeNotes = userNotes || "";
  
  if (!safeNotes.trim()) return jsonString;
  
  // Put JSON on top, human notes on bottom
  return `${jsonString} ${CONFIG.DELIMITER}\n\n${safeNotes.trim()}`;
}

/**
 * Helper function to include HTML/CSS/JS files inside other HTML files.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Fetches all active users in the Google Workspace directory.
 * Uses the People API so standard, non-admin users can access the company directory.
 */
function getWorkspaceUsers() {
  const users = [];
  
  try {
    let pageToken;
    do {
      // Fetches the public domain profile of coworkers
      const response = People.People.listDirectoryPeople('directories/my_customer', {
        readMask: 'names,emailAddresses',
        sources: 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE',
        pageSize: 100, // Max allowed per page
        pageToken: pageToken
      });

      if (response.people) {
        response.people.forEach(person => {
          // Only add them if they actually have an email address
          if (person.emailAddresses && person.emailAddresses.length > 0) {
            const email = person.emailAddresses[0].value;
            const name = person.names ? person.names[0].displayName : email.split('@')[0];
            
            users.push({
              email: email,
              name: name
            });
          }
        });
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

  } catch (err) {
    console.warn("Could not fetch Workspace directory: " + err.message);
    
    // Fallback: Just return the active user so the autocomplete isn't empty
    const myEmail = Session.getActiveUser().getEmail();
    users.push({
      email: myEmail,
      name: myEmail.split('@')[0]
    });
  }
  
  return users;
}