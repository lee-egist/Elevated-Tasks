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
 * Fetches directly from Supabase and maps them for the frontend.
 */
function getDashboardData() {
  try {
    const supabaseTasks = dbGetTasks();
    if (!supabaseTasks) return [];

    // Map Supabase rows to the format the frontend expects
    return supabaseTasks.map(task => ({
      id: task.id,
      taskListId: "@supabase", // Placeholder to keep the frontend drag-and-drop happy
      title: task.title || "",
      description: task.description || "",
      parent: null, // Subtasks can be re-added later if needed
      
      // Because we used 'select=*,projects(name)' in supabase.js, 
      // the project name is nested inside a 'projects' object!
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
 */
function createDashboardTask(taskListId, taskData) {
  try {
    // Automatically capture who is creating the task
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
      
      // Safety Checks: Ensure they are actual UUIDs before sending to the DB
      project_id: isValidUUID(taskData.project) ? taskData.project : null,
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
 */
function updateDashboardTaskStatus(taskId, taskListId, newStatus) {
  try {
    const payload = { status: newStatus };
    
    // Automation: Automatically stamp completion metrics!
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
 */
function updateDashboardTaskDetails(taskId, taskListId, updatedData) {
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
      
      project_id: isValidUUID(updatedData.project) ? updatedData.project : null,
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