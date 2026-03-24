/**
 * api.js
 * Strictly handles communicating with Google Tasks
 */

/**
 * Fetches all Task Lists the user owns.
 */
function fetchAllTaskLists() {
  let lists = [];
  let pageToken;
  do {
    const res = Tasks.Tasklists.list({ maxResults: 100, pageToken: pageToken });
    if (res.items) lists = lists.concat(res.items);
    pageToken = res.nextPageToken;
  } while (pageToken);
  return lists;
}

/**
 * The CORE DATA FETCHER for both the Web App and the Add-on.
 * Fetches tasks, parses metadata, and links children to parents.
 */
function fetchAndLinkTasks(taskListId = "all_lists") {
  let allTasks = [];
  let listsToFetch = [];

  if (taskListId === "all_lists") {
    listsToFetch = fetchAllTaskLists().map(l => l.id);
  } else {
    listsToFetch.push(taskListId);
  }

  // Fetch all tasks from targeted lists
  listsToFetch.forEach(listId => {
    let pageToken;
    do {
      const res = Tasks.Tasks.list(listId, { maxResults: 100, pageToken: pageToken });
      if (res.items) {
        // Tag with actual list ID so updates work
        allTasks = allTasks.concat(res.items.map(t => ({ ...t, actualListId: listId })));
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
  });

  const taskMap = {};
  const rootTasks = [];

  // Parse metadata and prep children array
  allTasks.forEach(task => {
    task.metadata = parseMetadata(task.notes) || {};
    task.children = [];
    taskMap[task.id] = task;
  });

  // Link children to parents
  allTasks.forEach(task => {
    if (task.parent && taskMap[task.parent]) {
      taskMap[task.parent].children.push(task);
    } else {
      rootTasks.push(task);
    }
  });

  return rootTasks; // Returns an array of parent tasks, with subtasks neatly tucked inside
}

/**
 * Creates a new task in the user's default task list.
 * @param {string} title - The visible title of the task.
 * @param {string} notes - Optional hidden metadata string.
 * @returns {Object} The created Task object.
 */
function createTask(title, notes = "") {
  try {
    const newTask = {
      title: title,
      notes: notes
    };
    // Insert the task using the Advanced Tasks Service
    const createdTask = Tasks.Tasks.insert(newTask, "@default");
    return createdTask;
  } catch (error) {
    console.error("Error creating task:", error);
    throw new Error("Failed to create task: " + error.message, { cause: error });
  }
}

function getTask(taskListId, taskId) {
  return Tasks.Tasks.get(taskListId, taskId);
}

function insertTask(taskListId, taskData) {
  return Tasks.Tasks.insert(taskData, taskListId);
}

function updateTaskData(taskListId, taskId, newTitle, newNotes) {
  const task = Tasks.Tasks.get(taskListId, taskId);
  task.title = newTitle;
  task.notes = newNotes;
  return Tasks.Tasks.update(task, taskListId, taskId);
}

/**
 * Deletes a task from the user's default list.
 * @param {string} taskId - The unique ID of the task.
 * @returns {boolean} True if successful.
 */
function deleteTask(taskId) {
  try {
    Tasks.Tasks.remove("@default", taskId);
    return true;
  } catch (error) {
    console.error("Error deleting task:", error);
    throw new Error("Failed to delete task: " + error.message, { cause: error });
  }
}

function fetchExistingProjects(taskListId = "@default") {
  const rootTasks = fetchAndLinkTasks(taskListId);
  const projects = new Set();
  
  // Look through tasks to find existing project tags
  rootTasks.forEach(task => {
    if (task.metadata && task.metadata.project) {
      projects.add(task.metadata.project);
    }
    task.children.forEach(child => {
       if (child.metadata && child.metadata.project) projects.add(child.metadata.project);
    });
  });
  
  return Array.from(projects).sort();
}