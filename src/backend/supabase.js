// @ts-check

/**
 * @typedef {Object} SupabaseTaskPayload
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [owner]
 * @property {string|null} [assignee]
 * @property {string} [status]
 * @property {string} [priority]
 * @property {string} [type]
 * @property {string|null} [start_date]
 * @property {string|null} [due_date]
 * @property {string|null} [project_id]
 * @property {string|null} [blocked_by]
 * @property {string} [completed_at]
 * @property {string} [started_at]
 * @property {string} [google_task_id]
 */

/**
 * @typedef {Object} SupabaseProjectPayload
 * @property {string} name
 * @property {string} [description]
 * @property {string} [owner_email]
 * @property {string} [status]
 */

/**
 * @returns {Object.<string, string>}
 */
function getSupabaseHeaders() {
  const props = PropertiesService.getScriptProperties();
  const serviceKey = props.getProperty('SUPABASE_SERVICE_KEY');
  const anonKey = props.getProperty('SUPABASE_ANON_KEY'); 
  
  if (!serviceKey || !anonKey) {
    throw new Error("Missing Supabase keys in Script Properties.");
  }

  return {
    "apikey": anonKey,
    "Authorization": "Bearer " + serviceKey,
    "Content-Type": "application/json",
    "Prefer": "return=representation" 
  };
}

/**
 * Universal request handler for Supabase API
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} method 
 * @param {string} endpoint 
 * @param {Object|null} [payload=null] 
 * @returns {any}
 */
function supabaseRequest(method, endpoint, payload = null) {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  
  if (!baseUrl) throw new Error("Missing SUPABASE_URL.");

  const url = `${baseUrl}/rest/v1/${endpoint}`;
  
  /** @type {GoogleAppsScript.URL_Fetch.URLFetchRequestOptions} */
  const options = {
    method: method,
    headers: getSupabaseHeaders(),
    muteHttpExceptions: true 
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode >= 200 && responseCode < 300) {
    return responseText ? JSON.parse(responseText) : null;
  } else {
    console.error(`Supabase Error (${responseCode}): ${responseText}`);
    throw new Error(`Database error: ${responseText}`);
  }
}

// --- TASK API FUNCTIONS ---

/**
 * @returns {any[]}
 */
function dbGetTasks() {
  return supabaseRequest('GET', 'tasks?select=*,projects(name)&order=created_at.desc');
}

/**
 * @param {SupabaseTaskPayload} taskData 
 * @returns {any}
 */
function dbCreateTask(taskData) {
  const res = supabaseRequest('POST', 'tasks', taskData);
  return res ? res[0] : null; 
}

/**
 * @param {string} taskId 
 * @param {SupabaseTaskPayload} taskData 
 * @returns {any}
 */
function dbUpdateTask(taskId, taskData) {
  const res = supabaseRequest('PATCH', `tasks?id=eq.${taskId}`, taskData);
  return res ? res[0] : null;
}

/**
 * @param {string} taskId 
 * @returns {any}
 */
function dbDeleteTask(taskId) {
  return supabaseRequest('DELETE', `tasks?id=eq.${taskId}`);
}

// --- PROJECT API FUNCTIONS ---

/**
 * @returns {any[]}
 */
function dbGetProjects() {
  const userEmail = Session.getActiveUser().getEmail();
  const encodedEmail = encodeURIComponent(userEmail);

  const ownedProjects = supabaseRequest('GET', `projects?owner_email=eq.${encodedEmail}&select=id,name`);
  const memberProjects = supabaseRequest('GET', `project_members?user_email=eq.${encodedEmail}&access_level=eq.edit&select=projects(id,name)`);

  const projectMap = new Map();

  if (ownedProjects) {
    ownedProjects.forEach(p => projectMap.set(p.id, { id: p.id, name: p.name }));
  }

  if (memberProjects) {
    memberProjects.forEach(pm => {
      if (pm.projects) {
        projectMap.set(pm.projects.id, { id: pm.projects.id, name: pm.projects.name });
      }
    });
  }

  return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {SupabaseProjectPayload} projectData 
 * @returns {any}
 */
function dbCreateProject(projectData) {
  const userEmail = Session.getActiveUser().getEmail();

  const payload = {
    name: projectData.name,
    description: projectData.description || "",
    owner_email: userEmail,
    status: "active" 
  };

  const res = supabaseRequest('POST', 'projects', payload);
  return res ? res[0] : null;
}

// --- USER PROFILE API FUNCTIONS ---

/**
 * @returns {any|null}
 */
function dbCheckMyProfile() {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  const profile = supabaseRequest('GET', `user_profiles?email=eq.${encodeURIComponent(email)}`);
  
  if (profile && profile.length > 0) {
    return profile[0];
  }
  return null;
}

/**
 * @param {string} displayName 
 * @param {number} weeklyCapacity 
 * @returns {any}
 */
function dbCreateProfile(displayName, weeklyCapacity) {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  
  const payload = {
    email: email,
    display_name: displayName,
    weekly_capacity_hours: weeklyCapacity || 40
  };
  
  const res = supabaseRequest('POST', 'user_profiles', payload);
  return res ? res[0] : null;
}

/**
 * @param {string} email 
 * @param {Object} profileData 
 * @returns {any}
 */
function dbUpdateProfile(email, profileData) {
  const safeEmail = encodeURIComponent(email.toLowerCase());
  return supabaseRequest('PATCH', `user_profiles?email=eq.${safeEmail}`, profileData);
}

/**
 * @param {string} teammateEmail 
 * @returns {void}
 */
function dbInviteTeammate(teammateEmail) {
  const cleanEmail = teammateEmail.trim().toLowerCase();
  const currentUser = Session.getActiveUser().getEmail();
  
  const existing = supabaseRequest('GET', `user_profiles?email=eq.${encodeURIComponent(cleanEmail)}`);
  if (existing && existing.length > 0) return; 

  supabaseRequest('POST', 'user_profiles', {
    email: cleanEmail,
    display_name: "Invited User",
    role: "pending" 
  });

  const webAppUrl = ScriptApp.getService().getUrl(); 
  const subject = `You've been invited to Elevated Tasks by ${currentUser}`;
  const body = `
    Hi there!
    
    ${currentUser} just assigned you a task in Elevated Tasks. 
    
    Click the link below to set up your profile and view your dashboard:
    ${webAppUrl}
    
    See you inside!
  `;
  
  try {
    GmailApp.sendEmail(cleanEmail, subject, body);
  } catch (err) {
    console.warn("Could not send invite email to " + cleanEmail + " error: " + err.message);
  }
}