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

/**
 * One-time migration script.
 * Reads all tasks from the user's default Google Task list, extracts the old ||| metadata, 
 * and injects them cleanly into Supabase.
 */
function migrateLegacyGoogleTasks() {
  try {
    let importCount = 0;
    const currentUser = Session.getActiveUser().getEmail();

    // 1. Fetch from the default Google Tasks list
    const tasksResponse = Tasks.Tasks.list('@default', { showHidden: true, maxResults: 100 });
    const items = tasksResponse.items || [];

    // 2. We need your existing Supabase projects so we don't duplicate them
    const existingProjects = dbGetProjects() || [];
    const projectMap = new Map();
    existingProjects.forEach(p => projectMap.set(p.name.toLowerCase(), p.id));

    items.forEach(task => {
      // Skip empty tasks
      if (!task.title || task.title.trim() === "") return;

      let description = task.notes || "";
      let metadata = {};

      // Parse the old ||| JSON format
      if (description.includes("|||")) {
        const parts = description.split("|||");
        description = parts[0].trim();
        try {
          metadata = JSON.parse(parts[1].trim());
        } catch (err) {
          console.warn("Could not parse metadata for task: " + task.title + "error" + err.message);
        }
      }

      // Handle Project mapping (create the project if it doesn't exist yet!)
      let projectId = null;
      let projectName = metadata.project ? metadata.project.trim() : null;

      if (projectName) {
        const lowerName = projectName.toLowerCase();
        if (projectMap.has(lowerName)) {
          projectId = projectMap.get(lowerName);
        } else {
          // Auto-create the project in Supabase so the relational link works!
          const newProject = dbCreateProject({ name: projectName, description: "Imported from Legacy Google Tasks" });
          if (newProject) {
            projectId = newProject.id;
            projectMap.set(lowerName, newProject.id); // Cache it so we don't create it twice
          }
        }
      }

      // Build the strict payload for Supabase
      const payload = {
        title: task.title,
        description: description,
        owner: currentUser,
        assignee: metadata.assignee || currentUser, // Default to self if unassigned
        status: metadata.status || (task.status === "completed" ? "completed" : "open"),
        priority: metadata.priority || "medium",
        type: metadata.type || "general",
        project_id: projectId,
        google_task_id: task.id // Save the native ID so we don't lose the link!
      };

      // Only add dates if they are valid to prevent Supabase crashes
      if (metadata.start_date && !isNaN(new Date(metadata.start_date).getTime())) {
        payload.start_date = new Date(metadata.start_date).toISOString().split('T')[0];
      }
      if (metadata.due_date && !isNaN(new Date(metadata.due_date).getTime())) {
        payload.due_date = new Date(metadata.due_date).toISOString().split('T')[0];
      } else if (task.due) {
        payload.due_date = new Date(task.due).toISOString().split('T')[0];
      }

      // Inject to database!
      dbCreateTask(payload);
      importCount++;
    });

    return importCount;
  } catch (err) {
    console.error("Migration Error: " + err);
    throw new Error("Migration failed: " + err.message, { cause: err });
  }
}

/**
 * Processes a CSV file uploaded from the frontend.
 * Maps columns based on the platform it originated from.
 */
function processCSVImport(csvContent, platform) {
  try {
    // Apps Script has a native CSV parser! It turns the string into a 2D array.
    const data = Utilities.parseCsv(csvContent);
    if (data.length < 2) throw new Error("CSV file is empty or missing data rows.");

    const headers = data[0].map(h => h.trim().toLowerCase());
    const rows = data.slice(1);

    const currentUser = Session.getActiveUser().getEmail();
    let importCount = 0;

    // We will need existing projects to map or auto-create them
    const existingProjects = dbGetProjects() || [];
    const projectMap = new Map();
    existingProjects.forEach(p => projectMap.set(p.name.toLowerCase(), p.id));

    rows.forEach(row => {
      // Create a clean object from the CSV row based on headers
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = row[index];
      });

      // ==========================================
      // THE MAPPING ENGINE
      // Here is where we translate specific platform jargon to your Supabase schema
      // ==========================================

      // eslint-disable-next-line no-useless-assignment
      let title = "";
      // eslint-disable-next-line no-useless-assignment
      let description = "";
      let status = "open";
      // eslint-disable-next-line no-useless-assignment
      let projectName = "";

      if (platform === 'asana') {
        title = rowData['name'] || "Untitled Asana Task";
        description = rowData['notes'] || "";
        projectName = rowData['projects'] || "";
        // Asana doesn't use standard statuses often, usually sections
      }
      else if (platform === 'trello') {
        title = rowData['card name'] || "Untitled Trello Card";
        description = rowData['card description'] || "";
        projectName = rowData['board name'] || "";
        status = rowData['list name'] ? "in_progress" : "open"; // Rough guess based on lists
      }
      else if (platform === 'jira') {
        title = rowData['summary'] || "Untitled Jira Issue";
        description = rowData['description'] || "";
        projectName = rowData['project name'] || "";
        status = (rowData['status'] && rowData['status'].toLowerCase() === 'done') ? 'completed' : 'open';
      }
      else {
        // Generic Fallback
        title = rowData['title'] || rowData['name'] || rowData['task'] || "Untitled Task";
        description = rowData['description'] || rowData['notes'] || "";
        projectName = rowData['project'] || "";
      }

      if (!title || title.trim() === "") return; // Skip completely blank rows

      // Handle Project UUID mapping
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

      // Build the Supabase Payload
      const payload = {
        title: title,
        description: description,
        owner: currentUser,
        status: status,
        priority: "medium", // Default to medium for imports unless specifically mapped
        project_id: projectId
      };

      // Push to Supabase!
      dbCreateTask(payload);
      importCount++;
    });

    return { success: true, count: importCount };

  } catch (err) {
    console.error("CSV Import Error: " + err);
    throw new Error("Failed to process CSV: " + err.message, { cause: err });
  }
}