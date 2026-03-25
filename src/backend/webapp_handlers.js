/**
 * webapp_handlers.js
 * Handles endpoints and data formatting specifically for the full-screen Web App.
 */

function doGet(e) {
  // Use createTemplateFromFile instead of createHtmlOutputFromFile
  const template = HtmlService.createTemplateFromFile('frontend/dashboard');

  // Evaluate the template (which runs the 'include' functions) before returning
  return template.evaluate()
      .setTitle("Elevated Tasks Dashboard")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Called by the Web App to get tasks. Uses the core API fetcher and flattens it for the Kanban board.
 */
function getDashboardData(taskListId = "all_lists") {
  try {
    const rootTasks = fetchAndLinkTasks(taskListId);
    const finalSortedTasks = [];

    // Helper to map a task for the Web App frontend
    const mapForFrontend = (task) => ({
      id: task.id,
      taskListId: task.actualListId, 
      title: task.title || "",
      parent: task.parent || null,
      project: task.metadata.project || "",
      assignee: task.metadata.assignee || "",
      status: task.metadata.status || "open",
      priority: task.metadata.priority || "medium",
      type: task.metadata.type || "general",
      due_date: task.metadata.due_date || "",
      blocked_by: task.metadata.blocked_by || "",
      updated_at: task.metadata.updated_at || ""
    });

    // Strictly sort Parents -> Children to prevent visual bugs
    rootTasks.forEach(rootTask => {
      finalSortedTasks.push(mapForFrontend(rootTask));
      if (rootTask.children && rootTask.children.length > 0) {
        rootTask.children.forEach(child => finalSortedTasks.push(mapForFrontend(child)));
      }
    });

    return finalSortedTasks;
  } catch (err) {
    console.error("Web App Data Error: " + err);
    return [];
  }
}

function updateDashboardTaskStatus(taskId, taskListId, newStatus) {
  const existingTask = getTask(taskListId, taskId);
  const metadata = parseMetadata(existingTask.notes);
  metadata.status = newStatus;
  metadata.updated_at = new Date().toISOString();
  
  updateTaskData(taskListId, taskId, existingTask.title, buildElevatedNotes(getCleanNotes(existingTask.notes), metadata));
  return true;
}

function updateDashboardTaskDetails(taskId, taskListId, updatedData) {
  const existingTask = getTask(taskListId, taskId);
  const metadata = { ...parseMetadata(existingTask.notes), ...updatedData, updated_at: new Date().toISOString() };
  
  updateTaskData(taskListId, taskId, updatedData.title || existingTask.title, buildElevatedNotes(getCleanNotes(existingTask.notes), metadata));
  return true;
}

/**
 * Creates a new task directly from the Web App.
 * Automatically splits human notes from JSON metadata.
 */
function createDashboardTask(taskListId, taskData) {
  try {
    const title = taskData.title || "Untitled";
    const description = taskData.description || "";
    
    // Remove the standard fields so we are only left with the custom metadata
    delete taskData.title;
    delete taskData.description;
    
    // Inject the creation timestamp
    const metadata = { 
      ...taskData, 
      updated_at: new Date().toISOString() 
    };
    
    // Use your unified engine to package it properly with the delimiter
    const finalNotes = buildElevatedNotes(description, metadata);
    
    // Insert it into Google Tasks
    const createdTask = Tasks.Tasks.insert({
      title: title,
      notes: finalNotes
    }, taskListId || "@default");
    
    return true;
  } catch (err) {
    console.error("Error creating Dashboard Task: " + err);
    throw new Error("Failed to create task: " + err.message, { cause: err });
  }
}