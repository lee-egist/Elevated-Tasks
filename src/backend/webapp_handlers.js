/**
 * webapp_handlers.js
 * Handles endpoints and data formatting specifically for the full-screen Web App.
 * Upgraded to use Supabase as the Source of Truth.
 */

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('frontend/dashboard');
  return template.evaluate()
    .setTitle("Elevated Tasks Dashboard")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Called by the Web App to get tasks.
 */
function getDashboardData() {
  try {
    const supabaseTasks = dbGetTasks();
    if (!supabaseTasks) return [];

    return supabaseTasks.map(task => ({
      id: task.id,
      taskListId: "@supabase", // Placeholder to keep the frontend drag-and-drop happy
      title: task.title || "",
      description: task.description || "",
      parent: null,
      project: task.projects ? task.projects.name : "",
      project_id: task.project_id || "",
      assignee: task.assignee || "",
      status: task.status || "open",
      priority: task.priority || "medium",
      type: task.type || "general",
      start_date: task.start_date || "",
      due_date: task.due_date || "",
      blocked_by: task.blocked_by || "",
      updated_at: task.updated_at || ""
    }));
  } catch (err) {
    console.error("Web App Data Error: " + err);
    throw new Error("Failed to load tasks: " + err.message, { cause: err });
  }
}

/**
 * Creates a new task in Supabase
 * 🛡️ FIXED: Removed legacy taskListId argument!
 */
function createDashboardTask(taskData) {
  try {
    const currentUser = Session.getActiveUser().getEmail();

    const supabasePayload = {
      title: taskData.title || "Untitled",
      description: taskData.description || "",
      owner: currentUser,
      assignee: taskData.assignee || null,
      status: taskData.status || "open",
      priority: taskData.priority || "medium",
      type: taskData.type || "general",
      start_date: taskData.start_date ? taskData.start_date : null,
      due_date: taskData.due_date ? taskData.due_date : null,
      project_id: isValidUUID(taskData.project_id) ? taskData.project_id : null,
      blocked_by: isValidUUID(taskData.blocked_by) ? taskData.blocked_by : null
    };

    dbCreateTask(supabasePayload);
    return true;
  } catch (err) {
    console.error("Error creating Dashboard Task: " + err);
    throw new Error("Failed to create task: " + err.message, { cause: err });
  }
}

/**
 * Updates just the status (used for Kanban Drag & Drop)
 * 🛡️ FIXED: Removed legacy taskListId argument!
 */
function updateDashboardTaskStatus(taskId, newStatus) {
  try {
    const payload = { status: newStatus };

    if (newStatus === 'completed') {
      payload.completed_at = new Date().toISOString();
    }
    if (newStatus === 'in_progress') {
      payload.started_at = new Date().toISOString();
    }

    dbUpdateTask(taskId, payload);
    return true;
  } catch (err) {
    throw new Error("Failed to update status: " + err.message, { cause: err });
  }
}

/**
 * Updates full task details from the Edit Modal
 * 🛡️ FIXED: Removed legacy taskListId argument!
 */
function updateDashboardTaskDetails(taskId, updatedData) {
  try {
    const payload = {
      title: updatedData.title,
      description: updatedData.description,
      assignee: updatedData.assignee || null,
      priority: updatedData.priority,
      status: updatedData.status,
      type: updatedData.type,
      start_date: updatedData.start_date ? updatedData.start_date : null,
      due_date: updatedData.due_date ? updatedData.due_date : null,
      project_id: isValidUUID(updatedData.project_id) ? updatedData.project_id : null,
      blocked_by: isValidUUID(updatedData.blocked_by) ? updatedData.blocked_by : null
    };

    dbUpdateTask(taskId, payload);
    return true;
  } catch (err) {
    throw new Error("Failed to update task: " + err.message, { cause: err });
  }
}

/**
 * Deletes a task from Supabase
 */
function deleteTask(taskId) {
  try {
    dbDeleteTask(taskId);
    return true;
  } catch (err) {
    throw new Error("Failed to delete task: " + err.message, { cause: err });
  }
}

/**
 * Utility: Checks if a string is a valid UUID to prevent database crashes
 */
function isValidUUID(str) {
  if (!str) return false;
  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  return regexExp.test(str);
}

/**
 * Fetches all projects for the frontend dropdowns
 */
function getDashboardProjects() {
  return dbGetProjects();
}

/**
 * Called by the Web App (or Gmail Add-on) to create a new project.
 */
function createNewProject(projectName, projectDescription) {
  try {
    if (!projectName || projectName.trim() === "") {
      throw new Error("Project name cannot be empty.");
    }

    const newProject = dbCreateProject({
      name: projectName.trim(),
      description: projectDescription ? projectDescription.trim() : ""
    });

    return newProject;
  } catch (err) {
    console.error("Error creating project: " + err);
    throw new Error("Failed to create project: " + err.message, { cause: err });
  }
}

// =========================================================================
// MIGRATION & IMPORT ENDPOINTS
// =========================================================================

function migrateLegacyGoogleTasks() {
  try {
    let importCount = 0;
    const currentUser = Session.getActiveUser().getEmail();

    const tasksResponse = Tasks.Tasks.list('@default', { showHidden: true, maxResults: 100 });
    const items = tasksResponse.items || [];

    const existingProjects = dbGetProjects() || [];
    const projectMap = new Map();
    existingProjects.forEach(p => projectMap.set(p.name.toLowerCase(), p.id));

    items.forEach(task => {
      if (!task.title || task.title.trim() === "") return;

      let description = task.notes || "";
      let metadata = {};

      if (description.includes("|||")) {
        const parts = description.split("|||");
        description = parts[0].trim();
        try {
          metadata = JSON.parse(parts[1].trim());
        } catch (err) {
          console.warn("Could not parse metadata for task: " + task.title + "error" + err.message);
        }
      }

      let projectId = null;
      let projectName = metadata.project ? metadata.project.trim() : null;

      if (projectName) {
        const lowerName = projectName.toLowerCase();
        if (projectMap.has(lowerName)) {
          projectId = projectMap.get(lowerName);
        } else {
          const newProject = dbCreateProject({ name: projectName, description: "Imported from Legacy Google Tasks" });
          if (newProject) {
            projectId = newProject.id;
            projectMap.set(lowerName, newProject.id);
          }
        }
      }

      const assigneeEmail = metadata.assignee ? metadata.assignee.toLowerCase() : currentUser;

      if (assigneeEmail !== currentUser) {
        dbInviteTeammate(assigneeEmail);
      }

      const payload = {
        title: task.title,
        description: description,
        owner: currentUser,
        assignee: assigneeEmail,
        status: metadata.status || (task.status === "completed" ? "completed" : "open"),
        priority: metadata.priority || "medium",
        type: metadata.type || "general",
        project_id: projectId,
        google_task_id: task.id 
      };

      if (metadata.start_date && !isNaN(new Date(metadata.start_date).getTime())) {
        payload.start_date = new Date(metadata.start_date).toISOString().split('T')[0];
      }
      if (metadata.due_date && !isNaN(new Date(metadata.due_date).getTime())) {
        payload.due_date = new Date(metadata.due_date).toISOString().split('T')[0];
      } else if (task.due) {
        payload.due_date = new Date(task.due).toISOString().split('T')[0];
      }

      dbCreateTask(payload);
      importCount++;
    });

    return importCount;
  } catch (err) {
    console.error("Migration Error: " + err);
    throw new Error("Migration failed: " + err.message, { cause: err });
  }
}

function processCSVImport(csvContent, platform) {
  try {
    const data = Utilities.parseCsv(csvContent);
    if (data.length < 2) throw new Error("CSV file is empty or missing data rows.");

    const headers = data[0].map(h => h.trim().toLowerCase());
    const rows = data.slice(1);

    const currentUser = Session.getActiveUser().getEmail();
    let importCount = 0;

    const existingProjects = dbGetProjects() || [];
    const projectMap = new Map();
    existingProjects.forEach(p => projectMap.set(p.name.toLowerCase(), p.id));

    rows.forEach(row => {
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = row[index];
      });

      // eslint-disable-next-line no-useless-assignment
      let title = "";
      // eslint-disable-next-line no-useless-assignment
      let description = "";
      let status = "open";
      // eslint-disable-next-line no-useless-assignment
      let projectName = "";
      // eslint-disable-next-line no-useless-assignment
      let assigneeEmail = null; 

      if (platform === 'asana') {
        title = rowData['name'] || "Untitled Asana Task";
        description = rowData['notes'] || "";
        projectName = rowData['projects'] || "";
        assigneeEmail = rowData['assignee'] || rowData['assignee email'] || null; 
      }
      else if (platform === 'trello') {
        title = rowData['card name'] || "Untitled Trello Card";
        description = rowData['card description'] || "";
        projectName = rowData['board name'] || "";
        status = rowData['list name'] ? "in_progress" : "open"; 
        assigneeEmail = rowData['members'] || rowData['member'] || null; 
      }
      else if (platform === 'jira') {
        title = rowData['summary'] || "Untitled Jira Issue";
        description = rowData['description'] || "";
        projectName = rowData['project name'] || "";
        status = (rowData['status'] && rowData['status'].toLowerCase() === 'done') ? 'completed' : 'open';
        assigneeEmail = rowData['assignee'] || null; 
      }
      else {
        title = rowData['title'] || rowData['name'] || rowData['task'] || "Untitled Task";
        description = rowData['description'] || rowData['notes'] || "";
        projectName = rowData['project'] || "";
        assigneeEmail = rowData['assignee'] || rowData['email'] || null; 
      }

      if (!title || title.trim() === "") return;

      let projectId = null;
      if (projectName && projectName.trim() !== "") {
        const lowerName = projectName.trim().toLowerCase();
        if (projectMap.has(lowerName)) {
          projectId = projectMap.get(lowerName);
        } else {
          const newProject = dbCreateProject({ name: projectName.trim(), description: `Imported from ${platform}` });
          if (newProject) {
            projectId = newProject.id;
            projectMap.set(lowerName, newProject.id);
          }
        }
      }

      if (assigneeEmail && assigneeEmail.includes('@')) {
        assigneeEmail = assigneeEmail.trim().toLowerCase();
        if (assigneeEmail !== currentUser) {
          dbInviteTeammate(assigneeEmail); 
        }
      } else {
        assigneeEmail = null; 
      }

      const payload = {
        title: title,
        description: description,
        owner: currentUser,
        assignee: assigneeEmail, 
        status: status,
        priority: "medium", 
        project_id: projectId
      };

      dbCreateTask(payload);
      importCount++;
    });

    return { success: true, count: importCount };

  } catch (err) {
    console.error("CSV Import Error: " + err);
    throw new Error("Failed to process CSV: " + err.message, { cause: err });
  }
}

// =========================================================================
// ONBOARDING & TEAM FUNCTIONS
// =========================================================================

/**
 * Silently ensures the user has a profile so database Foreign Keys don't crash.
 * Flags the profile as "basic" if they haven't filled out the official onboarding form yet.
 */
function ensureCurrentUserProfile() {
  try {
    const email = Session.getActiveUser().getEmail().toLowerCase();
    const defaultName = email.split('@')[0]; 
    
    let profile = dbCheckMyProfile();

    if (!profile) {
      profile = dbCreateProfile(defaultName, 40);
      profile.is_basic = true; 
    } else {
      profile.is_basic = (profile.display_name === defaultName || profile.display_name === "Invited User");
    }

    return profile;
  } catch (err) {
    console.error("Error ensuring profile: " + err);
    throw new Error("Failed to verify user profile: " + err.message, { cause: err });
  }
}

/**
 * 🛡️ RESTORED: Called by the Onboarding Modal to finalize the user's account.
 */
function submitUserOnboarding(displayName, weeklyCapacity) {
  try {
    if (!displayName || displayName.trim() === "") throw new Error("Display name is required.");
    
    // Create or overwrite the pending profile
    dbCreateProfile(displayName.trim(), parseFloat(weeklyCapacity) || 40);
    return true;
  } catch (err) {
    console.error("Error creating profile: " + err);
    throw new Error("Failed to create profile: " + err.message, { cause: err });
  }
}

/**
 * 🛡️ RESTORED: Fetches the Google Workspace directory users for the frontend auto-complete.
 */
function getWorkspaceDirectoryEmails() {
  try {
    const users = getWorkspaceUsers(); 
    return users.map(u => u.email);
  } catch (err) {
    console.warn("Could not fetch workspace directory: " + err);
    return []; 
  }
}