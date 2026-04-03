// // @ts-check

// /**
//  * @typedef {Object} SupabaseTaskPayload
//  * @property {string} title
//  * @property {string} [description]
//  * @property {string} [owner]
//  * @property {string|null} [assignee]
//  * @property {string} [status]
//  * @property {string} [priority]
//  * @property {number} [estimated_hours]
//  * @property {string} [project_id]
//  */

// /**
//  * @typedef {Object} SupabaseProjectPayload
//  * @property {string} name
//  * @property {string} [description]
//  * @property {string} [status]
//  * @property {string} [organization_id]
//  * @property {string} [owner_email]
//  */

// // ==========================================
// // INTERNAL PRIVATE FUNCTIONS
// // ==========================================

// /**
//  * Private helper to get the authenticated user's email reliably.
//  * @returns {string} The active user's email address.
//  */
// function getCurrentUserEmail_() {
//   return Session.getActiveUser().getEmail().toLowerCase();
// }

// /**
//  * Private headers function.
//  * @returns {Record<string, string>} The HTTP headers required for Supabase.
//  */
// function getSupabaseHeaders_() {
//   const props = PropertiesService.getScriptProperties();
//   const serviceKey = props.getProperty('SUPABASE_SERVICE_KEY');
//   const anonKey = props.getProperty('SUPABASE_ANON_KEY'); 
  
//   if (!serviceKey || !anonKey) {
//     throw new Error("Missing Supabase keys.");
//   }

//   return {
//     "apikey": anonKey,
//     "Authorization": "Bearer " + serviceKey,
//     "Content-Type": "application/json",
//     "Prefer": "return=representation" 
//   };
// }

// /**
//  * PRIVATE Universal request handler.
//  * @param {'get'|'post'|'patch'|'delete'} method - The HTTP method.
//  * @param {string} endpoint - The Supabase REST endpoint (e.g., 'tasks').
//  * @param {Record<string, any> | null} [payload=null] - The JSON payload for post/patch.
//  * @returns {any[] | Record<string, any> | null} The parsed JSON response from Supabase.
//  */
// function supabaseRequest_(method, endpoint, payload = null) {
//   const props = PropertiesService.getScriptProperties();
//   const baseUrl = props.getProperty('SUPABASE_URL');
//   if (!baseUrl) throw new Error("Missing SUPABASE_URL.");

//   const url = `${baseUrl}/rest/v1/${endpoint}`;
  
//   /** @type {GoogleAppsScript.URL_Fetch.URLFetchRequestOptions} */
//   const options = {
//     method: method,
//     headers: getSupabaseHeaders_(),
//     muteHttpExceptions: true 
//   };

//   if (payload) options.payload = JSON.stringify(payload);

//   const response = UrlFetchApp.fetch(url, options);
//   const responseCode = response.getResponseCode();
//   const responseText = response.getContentText();

//   if (responseCode >= 200 && responseCode < 300) {
//     return responseText ? JSON.parse(responseText) : null;
//   } else {
//     console.error(`Supabase Error (${responseCode}): ${responseText}`);
//     throw new Error(`Database error: ${responseText}`);
//   }
// }

// /**
//  * PRIVATE access checker: Verifies user is in the requested Organization.
//  * @param {string} email - The user's email address.
//  * @param {string} orgId - The UUID of the organization.
//  * @returns {boolean} True if the user is a member of the organization.
//  */
// function verifyOrgAccess_(email, orgId) {
//   const check = /** @type {any[] | null} */ (supabaseRequest_('get', `organization_members?user_email=eq.${encodeURIComponent(email)}&organization_id=eq.${orgId}`));
//   return (check && check.length > 0) || false;
// }


// // ==========================================
// // PUBLIC SAFE WRAPPERS
// // ==========================================

// // --- IDENTITY & ORGS ---

// /**
//  * Fetches the user's organizations.
//  * @returns {any[] | null} List of organizations.
//  */
// function dbGetMyOrganizations() {
//   const email = getCurrentUserEmail_();
//   return /** @type {any[] | null} */ (supabaseRequest_('get', `organization_members?user_email=eq.${encodeURIComponent(email)}&select=organizations(id,name,created_at)`));
// }

// /**
//  * Invites a teammate to the active organization and sends an email notification.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {string} teammateEmail - The email address of the teammate.
//  * @returns {void}
//  */
// function dbInviteTeammate(orgId, teammateEmail) {
//   const currentUserEmail = getCurrentUserEmail_();
  
//   // Security Check: You can only invite people to Orgs you belong to
//   if (!verifyOrgAccess_(currentUserEmail, orgId)) {
//     throw new Error("Unauthorized: You cannot invite users to this organization.");
//   }

//   const cleanEmail = teammateEmail.trim().toLowerCase();
//   const safeEmail = encodeURIComponent(cleanEmail);

//   // 1. Check if the user profile already exists
//   const existingProfile = /** @type {any[] | null} */ (supabaseRequest_('get', `user_profiles?email=eq.${safeEmail}`));
  
//   if (!existingProfile || existingProfile.length === 0) {
//     // Create placeholder profile
//     supabaseRequest_('post', 'user_profiles', {
//       email: cleanEmail,
//       display_name: "Invited User" // Role removed from here, as it's now in the Org Members table
//     });
//   }

//   // 2. Add them to the Organization
//   const existingMember = /** @type {any[] | null} */ (supabaseRequest_('get', `organization_members?user_email=eq.${safeEmail}&organization_id=eq.${orgId}`));
  
//   if (!existingMember || existingMember.length === 0) {
//     supabaseRequest_('post', 'organization_members', {
//       organization_id: orgId,
//       user_email: cleanEmail,
//       org_role: 'member' // Grant basic access to the org
//     });
//   }

//   // 3. Send the invite email via GmailApp
//   const webAppUrl = ScriptApp.getService().getUrl(); 
//   const subject = `You've been invited to Elevated Tasks by ${currentUserEmail}`;
//   const body = `
//     Hi there!
    
//     ${currentUserEmail} just invited you to collaborate in their workspace on Elevated Tasks. 
    
//     Click the link below to set up your profile and view your dashboard:
//     ${webAppUrl}
    
//     See you inside!
//   `;
  
//   try {
//     GmailApp.sendEmail(cleanEmail, subject, body);
//   } catch (err) {
//     console.warn("Could not send invite email to " + cleanEmail + " error: " + err);
//   }
// }

// /**
//  * Checks if the user has a profile.
//  * @returns {Record<string, any> | null} The user's profile object.
//  */
// function dbCheckMyProfile() {
//   const email = getCurrentUserEmail_();
//   const profile = /** @type {any[] | null} */ (supabaseRequest_('get', `user_profiles?email=eq.${encodeURIComponent(email)}`));
//   return (profile && profile.length > 0) ? profile[0] : null;
// }

// /**
//  * Creates a new user profile.
//  * @param {string} displayName - The user's chosen display name.
//  * @returns {Record<string, any> | null} The created profile object.
//  */
// function dbCreateProfile(displayName) {
//   const email = getCurrentUserEmail_();
//   const payload = { email: email, display_name: displayName };
//   const res = /** @type {any[] | null} */ (supabaseRequest_('post', 'user_profiles', payload));
//   return res ? res[0] : null;
// }

// /**
//  * Updates the current user's profile.
//  * @param {Partial<{display_name: string, weekly_capacity_hours: number}>} profileData - Data to update.
//  * @returns {Record<string, any> | null} The updated profile object.
//  */
// function dbUpdateProfile(profileData) {
//   const email = getCurrentUserEmail_();
//   const safeEmail = encodeURIComponent(email);
  
//   const res = /** @type {any[] | null} */ (supabaseRequest_('patch', `user_profiles?email=eq.${safeEmail}`, profileData));
//   return res ? res[0] : null;
// }
// // --- PROJECTS ---

// /**
//  * Fetches all projects for an organization.
//  * @param {string} orgId - The UUID of the organization.
//  * @returns {any[] | null} List of projects.
//  */
// function dbGetProjects(orgId) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) {
//     throw new Error("Unauthorized: You do not have access to this organization.");
//   }
//   return /** @type {any[] | null} */ (supabaseRequest_('get', `projects?organization_id=eq.${orgId}&select=id,name,is_system_managed,status&order=created_at.desc`));
// }

// /**
//  * Creates a new project.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {SupabaseProjectPayload} projectData - The project details.
//  * @returns {Record<string, any> | null} The created project object.
//  */
// function dbCreateProject(orgId, projectData) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) {
//     throw new Error("Unauthorized: You cannot create projects in this organization.");
//   }
  
//   /** @type {SupabaseProjectPayload} */
//   const payload = {
//     ...projectData,
//     organization_id: orgId,
//     owner_email: email
//   };
  
//   const res = /** @type {any[] | null} */ (supabaseRequest_('post', 'projects', payload));
//   return res ? res[0] : null;
// }

// // --- TASKS ---

// /**
//  * Fetches tasks for a specific project.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {string} projectId - The UUID of the project.
//  * @returns {any[] | null} List of tasks.
//  */
// function dbGetTasksByProject(orgId, projectId) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) {
//     throw new Error("Unauthorized: You cannot view tasks in this organization.");
//   }
//   return /** @type {any[] | null} */ (supabaseRequest_('get', `tasks?project_id=eq.${projectId}&select=*&order=created_at.desc`));
// }

// /**
//  * Creates a new task.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {string} projectId - The UUID of the project.
//  * @param {SupabaseTaskPayload} taskData - The task details.
//  * @returns {Record<string, any> | null} The created task object.
//  */
// function dbCreateTask(orgId, projectId, taskData) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized access.");

//   /** @type {SupabaseTaskPayload} */
//   const payload = {
//     ...taskData,
//     project_id: projectId,
//     owner: email
//   };
  
//   const res = /** @type {any[] | null} */ (supabaseRequest_('post', 'tasks', payload));
//   return res ? res[0] : null; 
// }

// /**
//  * Updates an existing task.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {string} taskId - The UUID of the task to update.
//  * @param {Partial<SupabaseTaskPayload>} taskData - The fields to update.
//  * @returns {Record<string, any> | null} The updated task object.
//  */
// function dbUpdateTask(orgId, taskId, taskData) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized access.");
  
//   const res = /** @type {any[] | null} */ (supabaseRequest_('patch', `tasks?id=eq.${taskId}`, taskData));
//   return res ? res[0] : null;
// }

// /**
//  * Deletes a task.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {string} taskId - The UUID of the task to delete.
//  * @returns {boolean} True if successful.
//  */
// function dbDeleteTask(orgId, taskId) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized access.");
  
//   // Supabase REST API handles DELETE requests
//   supabaseRequest_('delete', `tasks?id=eq.${taskId}`);
//   return true;
// }

// // --- AI & KNOWLEDGE BASE ---

// /**
//  * Records a task state snapshot for predictive algorithms.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {string} taskId - The UUID of the task.
//  * @param {string} status - The current status of the task.
//  * @param {number} remainingHours - The estimated hours remaining.
//  * @param {boolean} wasBlocked - Whether the task was blocked at the time of the snapshot.
//  * @returns {Record<string, any> | null} The created snapshot record.
//  */
// function dbCreateTaskSnapshot(orgId, taskId, status, remainingHours, wasBlocked) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized access.");

//   const payload = {
//     task_id: taskId,
//     status_at_time: status,
//     remaining_hours_estimate: remainingHours,
//     was_blocked: wasBlocked
//   };
//   const res = /** @type {any[] | null} */ (supabaseRequest_('post', 'task_snapshots', payload));
//   return res ? res[0] : null;
// }

// /**
//  * Saves a parsed conversational thread for context generation.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {string} summaryText - AI generated summary of the thread.
//  * @param {string} sourceUrl - Link to the original thread (e.g., Gmail/Slack link).
//  * @param {Record<string, any>} metadataJson - Raw metadata about the participants and timing.
//  * @returns {Record<string, any> | null} The created context thread record.
//  */
// function dbSaveContextThread(orgId, summaryText, sourceUrl, metadataJson) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized access.");

//   const payload = {
//     organization_id: orgId,
//     summary_text: summaryText,
//     source_url: sourceUrl,
//     raw_json_metadata: metadataJson
//   };
//   const res = /** @type {any[] | null} */ (supabaseRequest_('post', 'context_threads', payload));
//   return res ? res[0] : null;
// }

// /**
//  * Links a task to the context thread that generated it.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {string} taskId - The UUID of the generated task.
//  * @param {string} threadId - The UUID of the context thread.
//  * @returns {Record<string, any> | null} The created junction record.
//  */
// function dbLinkTaskToContext(orgId, taskId, threadId) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized access.");

//   const res = /** @type {any[] | null} */ (supabaseRequest_('post', 'task_context_links', { task_id: taskId, thread_id: threadId }));
//   return res ? res[0] : null;
// }

// // --- RISK MANAGEMENT ---

// /**
//  * Logs an AI-identified risk factor against a task.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {string} taskId - The UUID of the task at risk.
//  * @param {string} riskFactorId - The UUID of the recognized risk factor category.
//  * @param {number} confidence - The AI's confidence score in the risk.
//  * @param {number} probability - The probability score (1-5).
//  * @param {number} impact - The impact score (1-5).
//  * @returns {Record<string, any> | null} The created task risk record.
//  */
// function dbLogTaskRisk(orgId, taskId, riskFactorId, confidence, probability, impact) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized access.");

//   const payload = {
//     task_id: taskId,
//     risk_factor_id: riskFactorId,
//     ai_confidence_score: confidence,
//     probability_score: probability,
//     impact_score: impact
//   };
//   const res = /** @type {any[] | null} */ (supabaseRequest_('post', 'task_risks', payload));
//   return res ? res[0] : null;
// }

// /**
//  * Adds a mitigation suggestion to an identified task risk.
//  * @param {string} orgId - The UUID of the organization.
//  * @param {string} taskRiskId - The UUID of the task risk record.
//  * @param {string} suggestionText - The AI's suggested mitigation steps.
//  * @returns {Record<string, any> | null} The created mitigation suggestion record.
//  */
// function dbAddMitigationSuggestion(orgId, taskRiskId, suggestionText) {
//   const email = getCurrentUserEmail_();
//   if (!verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized access.");

//   const payload = {
//     task_risk_id: taskRiskId,
//     suggestion_text: suggestionText,
//     status: 'suggested'
//   };
//   const res = /** @type {any[] | null} */ (supabaseRequest_('post', 'risk_mitigation_suggestions', payload));
//   return res ? res[0] : null;
// }

// if (typeof module !== 'undefined') {
//   module.exports = {  
//     dbGetMyOrganizations,
//     dbInviteTeammate,
//     dbCheckMyProfile,
//     dbCreateProfile,
//     dbUpdateProfile,
//     dbGetProjects,
//     dbCreateProject,
//     dbGetTasksByProject,
//     dbCreateTask, 
//     dbUpdateTask,
//     dbDeleteTask,
//     dbCreateTaskSnapshot,
//     dbSaveContextThread,
//     dbLinkTaskToContext,
//     dbLogTaskRisk,
//     dbAddMitigationSuggestion
//   };
// }