/**
 * supabase.js
 * Handles all secure communication between Google Apps Script and Supabase via REST API.
 */

// --- CORE FETCH WRAPPER ---
function getSupabaseHeaders() {
  const props = PropertiesService.getScriptProperties();
  const serviceKey = props.getProperty('SUPABASE_SERVICE_KEY');
  const anonKey = props.getProperty('SUPABASE_ANON_KEY'); // Fetch the new public key
  
  if (!serviceKey || !anonKey) {
    throw new Error("Missing Supabase keys in Script Properties. Ensure both SUPABASE_SERVICE_KEY and SUPABASE_ANON_KEY are set.");
  }

  return {
    "apikey": anonKey,                       // Gets us past the API Gateway browser check
    "Authorization": "Bearer " + serviceKey, // Gives us backend "God mode" in the database
    "Content-Type": "application/json",
    "Prefer": "return=representation" 
  };
}

/**
 * Universal request handler for Supabase API
 */
function supabaseRequest(method, endpoint, payload = null) {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  
  if (!baseUrl) throw new Error("Missing SUPABASE_URL in Script Properties.");

  const url = `${baseUrl}/rest/v1/${endpoint}`;
  
  const options = {
    method: method,
    headers: getSupabaseHeaders(),
    muteHttpExceptions: true // Allows us to read the error message from Supabase instead of instantly crashing
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  // Supabase returns 200-299 for success
  if (responseCode >= 200 && responseCode < 300) {
    return responseText ? JSON.parse(responseText) : null;
  } else {
    console.error(`Supabase Error (${responseCode}): ${responseText}`);
    throw new Error(`Database error: ${responseText}`);
  }
}

// --- TASK API FUNCTIONS ---

/**
 * Fetches all tasks. 
 * Because we use foreign keys, 'select=*,projects(name)' automatically joins 
 * the project name directly into the task data!
 */
function dbGetTasks() {
  return supabaseRequest('GET', 'tasks?select=*,projects(name)&order=created_at.desc');
}

/**
 * Creates a new task in Supabase.
 */
function dbCreateTask(taskData) {
  const res = supabaseRequest('POST', 'tasks', taskData);
  return res ? res[0] : null; // Supabase returns an array, we want the first object
}

/**
 * Updates an existing task by its UUID.
 */
function dbUpdateTask(taskId, taskData) {
  const res = supabaseRequest('PATCH', `tasks?id=eq.${taskId}`, taskData);
  return res ? res[0] : null;
}

/**
 * Deletes a task by its UUID.
 */
function dbDeleteTask(taskId) {
  return supabaseRequest('DELETE', `tasks?id=eq.${taskId}`);
}

// --- PROJECT API FUNCTIONS ---

// --- PROJECT API FUNCTIONS ---

/**
 * Fetches projects where the active user is either the OWNER or an EDITOR.
 */
function dbGetProjects() {
  const userEmail = Session.getActiveUser().getEmail();
  const encodedEmail = encodeURIComponent(userEmail);

  // 1. Get projects where the user is the absolute owner
  const ownedProjects = supabaseRequest('GET', `projects?owner_email=eq.${encodedEmail}&select=id,name`);

  // 2. Get projects from the junction table where the user has 'edit' access.
  // The 'select=projects(id,name)' part tells Supabase to grab the project details through the Foreign Key!
  const memberProjects = supabaseRequest('GET', `project_members?user_email=eq.${encodedEmail}&access_level=eq.edit&select=projects(id,name)`);

  // 3. Combine them and remove any duplicates using a Map
  const projectMap = new Map();

  if (ownedProjects) {
    ownedProjects.forEach(p => projectMap.set(p.id, { id: p.id, name: p.name }));
  }

  if (memberProjects) {
    memberProjects.forEach(pm => {
      // Because we fetched through the junction table, the data is nested inside 'projects'
      if (pm.projects) {
        projectMap.set(pm.projects.id, { id: pm.projects.id, name: pm.projects.name });
      }
    });
  }

  // Convert the Map back to an array and sort alphabetically
  return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Creates a new project in the database.
 * Automatically sets the active user as the absolute owner.
 */
function dbCreateProject(projectData) {
  const userEmail = Session.getActiveUser().getEmail();

  const payload = {
    name: projectData.name,
    description: projectData.description || "",
    owner_email: userEmail,
    status: "active" // Default new projects to active
  };

  const res = supabaseRequest('POST', 'projects', payload);
  return res ? res[0] : null;
}