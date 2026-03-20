/**
 * ui.js
 * Strictly handles building CardService widgets and layouts for the Google Workspace Add-on.
 * @module UI
 */

/**
 * Builds the detailed editor card for a specific task, rendering inputs for metadata.
 * @param {Object} e - The event object provided by the Google Workspace Add-on trigger.
 * @returns {GoogleAppsScript.Card_Service.Card} The constructed Card object for the task editor.
 */
function buildTaskCard(e) {
  // 1. Resolve IDs from the event object
  let taskId, taskListId;
  if (e && e.taskItem) {
    taskId = e.taskItem.id;
    taskListId = e.taskItem.taskListId;
  } else if (e && e.parameters && e.parameters.taskId) {
    taskId = e.parameters.taskId;
    taskListId = e.parameters.taskListId || "@default";
  } else {
    return CardService.newCardBuilder()
        .addSection(CardService.newCardSection()
            .addWidget(CardService.newTextParagraph().setText("⚠️ Please select a task from your 'Elevated' Task List to begin.")))
        .build();
  }

  // 2. Fetch required data utilizing our new API and Utils functions
  const task = getTask(taskListId, taskId);
  const metadata = parseMetadata(task.notes);
  const existingUserNotes = getCleanNotes(task.notes);
  
  let projectList = fetchExistingProjects(taskListId);
  if (projectList.length === 0) projectList = ["General"];

  // Fetch workspace users for the Assignee autocomplete
  const workspaceUsers = getWorkspaceUsers();
  const userEmails = workspaceUsers.map(user => user.email);
  
  // Get the current user's email to use as a default assignee
  const currentUserEmail = Session.getActiveUser().getEmail();

  // 3. Build UI Sections
  const templateSection = CardService.newCardSection()
      .setHeader("Template Engine")
      .setCollapsible(true);
  
  const templateDropdown = CardService.newSelectionInput()
      .setFieldName("template_project_name")
      .setTitle("Select Project to Reuse")
      .setType(CardService.SelectionInputType.DROPDOWN);
      
  projectList.forEach(proj => templateDropdown.addItem(proj, proj, false));
  templateSection.addWidget(templateDropdown);
  
  templateSection.addWidget(CardService.newTextButton()
      .setText("♻️ Duplicate Project Tasks")
      .setOnClickAction(CardService.newAction().setFunctionName('handleCloneProject').setParameters({taskListId: taskListId})));

  const detailSection = CardService.newCardSection().setHeader("Elevated Task Details");

  // Title and Description inputs for standalone app behavior
  detailSection.addWidget(CardService.newTextInput()
      .setFieldName("task_title")
      .setTitle("Task Title")
      .setValue(task.title || ""));

  detailSection.addWidget(CardService.newTextInput()
      .setFieldName("task_description")
      .setTitle("Task Description")
      .setMultiline(true)
      .setValue(existingUserNotes || ""));

  detailSection.addWidget(CardService.newTextInput()
      .setFieldName("task_project")
      .setTitle("Project / Initiative")
      .setValue(metadata.project || "")
      .setSuggestions(CardService.newSuggestions().addSuggestions(projectList)));

  // --- NEW: Parent Task Dropdown ---
  const parentDropdown = CardService.newSelectionInput()
      .setFieldName("task_parent")
      .setTitle("Subtask of...")
      .setType(CardService.SelectionInputType.DROPDOWN)
      .addItem("None (Top Level Task)", "none", !task.parent);

  try {
    const tasksResponse = Tasks.Tasks.list(taskListId, { maxResults: 100 });
    if (tasksResponse.items) {
      tasksResponse.items.forEach(t => {
        // Prevent a task from being its own parent
        if (t.id !== task.id) { 
          const isSelected = (task.parent === t.id);
          parentDropdown.addItem(t.title, t.id, isSelected);
        }
      });
    }
  } catch (err) {
    console.error("Could not load parent tasks: " + err);
  }

  detailSection.addWidget(parentDropdown);

  const assigneeInput = CardService.newTextInput()
      .setFieldName("task_assignee")
      .setTitle("Assignee (Email)")
      .setValue(metadata.assignee || currentUserEmail);

  if (userEmails.length > 0) {
    assigneeInput.setSuggestions(CardService.newSuggestions().addSuggestions(userEmails));
  }
      
  detailSection.addWidget(assigneeInput);

  detailSection.addWidget(CardService.newSelectionInput()
      .setFieldName("task_status")
      .setTitle("Current Status")
      .setType(CardService.SelectionInputType.DROPDOWN)
      .addItem("Open", "open", metadata.status === "open" || !metadata.status)
      .addItem("In Progress", "in_progress", metadata.status === "in_progress")
      .addItem("Blocked", "blocked", metadata.status === "blocked")
      .addItem("Completed", "completed", metadata.status === "completed"));

  detailSection.addWidget(CardService.newSelectionInput()
      .setFieldName("task_priority")
      .setTitle("Priority")
      .setType(CardService.SelectionInputType.DROPDOWN)
      .addItem("Low", "low", metadata.priority === "low")
      .addItem("Medium", "medium", metadata.priority === "medium" || !metadata.priority)
      .addItem("High", "high", metadata.priority === "high")
      .addItem("Critical", "critical", metadata.priority === "critical"));

  // Start Date Picker
  const startPicker = CardService.newDatePicker()
      .setFieldName("task_start_date")
      .setTitle("Start Date");
      
  if (metadata.start_date) {
    const parsedDate = new Date(metadata.start_date);
    // Safety check to prevent NaN errors from corrupted/empty legacy dates
    if (!isNaN(parsedDate.getTime())) {
      startPicker.setValueInMsSinceEpoch(parsedDate.getTime());
    }
  }
  detailSection.addWidget(startPicker);

  // Due Date Picker
  const duePicker = CardService.newDatePicker()
      .setFieldName("task_due_date")
      .setTitle("Due Date");
      
  if (metadata.due_date) {
    const parsedDueDate = new Date(metadata.due_date);
    if (!isNaN(parsedDueDate.getTime())) {
      duePicker.setValueInMsSinceEpoch(parsedDueDate.getTime());
    }
  }
  detailSection.addWidget(duePicker);

  detailSection.addWidget(CardService.newSelectionInput()
      .setFieldName("task_type")
      .setTitle("Task Type")
      .setType(CardService.SelectionInputType.DROPDOWN)
      .addItem("General", "general", metadata.type === "general" || !metadata.type)
      .addItem("Bug", "bug", metadata.type === "bug")
      .addItem("Feature", "feature", metadata.type === "feature")
      .addItem("Milestone", "milestone", metadata.type === "milestone"));

  detailSection.addWidget(CardService.newTextInput()
      .setFieldName("task_dependencies")
      .setTitle("Blocked By (Task ID)")
      .setValue(metadata.blocked_by || "")
      .setHint("Paste ID from the footer below"));


  const saveAction = CardService.newAction()
      .setFunctionName('handleSave')
      .setParameters({ taskId: taskId, taskListId: taskListId });

  detailSection.addWidget(CardService.newTextButton()
      .setText("SAVE ELEVATED DATA")
      .setOnClickAction(saveAction)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED));

  const footerSection = CardService.newCardSection().setHeader("System Info").setCollapsible(true);
  footerSection.addWidget(CardService.newTextInput()
      .setFieldName("display_id")
      .setTitle("Copy Task ID:")
      .setValue(taskId));

  // Manual refresh trigger for this specific task
  const reloadAction = CardService.newAction()
      .setFunctionName('buildTaskCard') // Changed from showTaskEditor to directly reload
      .setParameters({ taskId: taskId, taskListId: taskListId });

  footerSection.addWidget(CardService.newTextButton()
      .setText("↻ Reload Task Data")
      .setOnClickAction(reloadAction));

  return CardService.newCardBuilder()
    .addSection(templateSection)
    .addSection(detailSection)
    .addSection(footerSection)
    .build();
}

/**
 * Action handler for the "CREATE TASK" button on the homepage.
 * Parses inputs and calls the hybrid API to sync to Google Tasks and Supabase.
 * @param {Object} e - The event object.
 */
function handleCreateFromHome(e) {
  const formInputs = e.commonEventObject.formInputs;
  const title = formInputs.new_task_title ? formInputs.new_task_title.stringInputs.value[0] : "Untitled Task";
  const project = formInputs.new_task_project ? formInputs.new_task_project.stringInputs.value[0] : "";
  
  let targetListId = formInputs.new_task_list_id ? formInputs.new_task_list_id.stringInputs.value[0] : "@default";

  // Build the initial metadata
  const metadata = { project: project, status: "open", priority: "medium" };
  
  // Create and Sync!
  createElevatedTask(targetListId, { title: title }, metadata);

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Task Created & Synced to Database!"))
    .build();
}


/**
 * Action handler for the "SAVE ELEVATED DATA" button in the task editor.
 * Extends the existing Google Tasks patch logic and handles subtask movement.
 * @param {Object} e - The event object.
 */
function handleSave(e) {
  const formInputs = e.commonEventObject.formInputs;
  const taskId = e.parameters.taskId;
  const taskListId = e.parameters.taskListId;

  const title = formInputs.task_title ? formInputs.task_title.stringInputs.value[0] : "";
  const description = formInputs.task_description ? formInputs.task_description.stringInputs.value[0] : "";
  
  const metadata = {
    project: formInputs.task_project ? formInputs.task_project.stringInputs.value[0] : "",
    assignee: formInputs.task_assignee ? formInputs.task_assignee.stringInputs.value[0] : "",
    status: formInputs.task_status ? formInputs.task_status.stringInputs.value[0] : "open",
    priority: formInputs.task_priority ? formInputs.task_priority.stringInputs.value[0] : "medium",
    type: formInputs.task_type ? formInputs.task_type.stringInputs.value[0] : "general",
    blocked_by: formInputs.task_dependencies ? formInputs.task_dependencies.stringInputs.value[0] : ""
  };

  // Process dates if they were provided
  if (formInputs.task_start_date) {
    metadata.start_date = formInputs.task_start_date.dateInput.msSinceEpoch;
  }
  if (formInputs.task_due_date) {
    metadata.due_date = formInputs.task_due_date.dateInput.msSinceEpoch;
  }

  // Combine UI notes with stringified JSON payload
  const finalNotes = buildElevatedNotes(description, metadata);
  
  // 1. Update the Personal Google Task text/data
  updateTaskData(taskListId, taskId, title, finalNotes);

  // 2. NEW: Handle moving the task under a parent
  const newParentId = formInputs.task_parent ? formInputs.task_parent.stringInputs.value[0] : "none";
  try {
    if (newParentId === "none") {
      // Move to root (clear any existing parent)
      Tasks.Tasks.move(taskListId, taskId); 
    } else {
      // Move under the newly selected parent task
      Tasks.Tasks.move(taskListId, taskId, { parent: newParentId });
    }
  } catch (err) {
    console.error("Failed to move task: " + err.message);
  }

  // 3. Return to the homepage dashboard to see the updated task tree
  // FIXED: Now calls buildDashboardCard(e) to match the function name at the bottom
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Task updated and moved!"))
    .setNavigation(CardService.newNavigation().popToRoot().updateCard(buildDashboardCard(e)))
    .build();
}

/**
 * Builds the main dashboard card, grouped by projects with subtasks.
 */
/**
 * Builds the main dashboard card, grouped by projects with subtasks.
 * Now includes Quick Create and List Filtering.
 */
/**
 * Builds the main dashboard card, grouped by projects with subtasks.
 * Now includes Quick Create and List Filtering.
 */
function buildDashboardCard(e, taskListId = "@default", availableLists = []) {
  const builder = CardService.newCardBuilder();
  
  builder.setHeader(CardService.newCardHeader()
    .setTitle("PM Dashboard")
    .setSubtitle("Grouped by Project"));

  // =========================================
  // SECTION 1: CONTROLS (Filter & Quick Create)
  // =========================================
  const controlSection = CardService.newCardSection();

  // --- NEW: Add your Web App Link Button Here ---
  // PASTE YOUR /dev OR /exec URL IN THE QUOTES BELOW
  const webAppUrl = "https://script.google.com/a/macros/ncnursingacademy.com/s/AKfycbxdw6DK860yYOZqRSRqy2ZYvug6aWm0qPTjMkC6gE6UH_c_RI7GcttZ7IGmjEGu2ynr/exec"; ""

  controlSection.addWidget(CardService.newTextButton()
    .setText("🌐 Open Full Web Dashboard")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOpenLink(CardService.newOpenLink()
      .setUrl(webAppUrl)
      .setOpenAs(CardService.OpenAs.FULL_SIZE)
      .setOnClose(CardService.OnClose.NOTHING)));
  // ----------------------------------------------

  // 1A. List Selector Dropdown
  const listDropdown = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Filter by Task List")
    .setFieldName("selected_task_list")
    .setOnChangeAction(CardService.newAction().setFunctionName("handleTaskListChange"));

  availableLists.forEach(list => {
    listDropdown.addItem(list.title, list.id, list.id === taskListId);
  });
  controlSection.addWidget(listDropdown);

  // 1B. Quick Create Inputs
  controlSection.addWidget(CardService.newTextInput()
    .setFieldName("new_task_title")
    .setTitle("New Task Title"));

  controlSection.addWidget(CardService.newTextInput()
    .setFieldName("new_task_project")
    .setTitle("Project Name (Optional)"));

  controlSection.addWidget(CardService.newTextButton()
    .setText("➕ Quick Create Task")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName("handleCreateFromHome")
      .setParameters({ currentListId: taskListId }))); 

  builder.addSection(controlSection);

 // =========================================
  // SECTION 2: TASK TREE (Grouped by Project)
  // =========================================
  
  // 1. Fetch our beautifully organized root tasks from the new API
  const rootTasks = fetchAndLinkTasks(taskListId);
  
  // 2. Group them into project buckets
  const groupedProjects = {};
  rootTasks.forEach(task => {
    // Safely check for the project tag, fallback to "General"
    const projectName = (task.metadata && task.metadata.project) ? task.metadata.project : "General";
    if (!groupedProjects[projectName]) groupedProjects[projectName] = [];
    groupedProjects[projectName].push(task);
  });

  const sortedProjectNames = Object.keys(groupedProjects).sort();

  // 3. Handle the empty state if there are no tasks
  if (sortedProjectNames.length === 0) {
    builder.addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText("No tasks found in this list.")));
    return builder.build();
  }

  // 4. Build the UI Sections for each project
  sortedProjectNames.forEach(projectName => {
    const projectSection = CardService.newCardSection().setHeader(`📁 Project: ${projectName}`);
    const tasksInProject = groupedProjects[projectName];

    tasksInProject.forEach(task => {
      // Add the Parent Task - PASSING taskListId HERE
      projectSection.addWidget(createTaskRowWidget(task, false, taskListId));

      // Add the Children (Subtasks) directly beneath it
      if (task.children && task.children.length > 0) {
        task.children.forEach(child => {
          // PASSING taskListId HERE TOO
          projectSection.addWidget(createTaskRowWidget(child, true, taskListId));
        });
      }
    });
    
    builder.addSection(projectSection);
  });

  return builder.build();
}

/**
 * Helper to generate a consistent UI row for a task.
 * @param {Object} task - The task object.
 * @param {boolean} isSubtask - Whether to indent the UI.
 */
/**
 * Helper to generate a consistent UI row for a task.
 * @param {Object} task - The task object.
 * @param {boolean} isSubtask - Whether to indent the UI.
 * @param {string} taskListId - The ID of the list this task belongs to.
 */
function createTaskRowWidget(task, isSubtask, taskListId = "@default") {
  const titlePrefix = isSubtask ? "      ↳ " : "";
  const iconUrl = task.status === "completed" 
    ? "https://fonts.gstatic.com/s/i/googlematerialicons/check_circle/v6/24px.svg" 
    : "https://fonts.gstatic.com/s/i/googlematerialicons/radio_button_unchecked/v6/24px.svg";

  return CardService.newDecoratedText()
    .setText(titlePrefix + task.title)
    .setBottomLabel(task.metadata ? (task.metadata.status || "open") : "open")
    .setStartIcon(CardService.newIconImage().setIconUrl(iconUrl))
    .setOnClickAction(CardService.newAction()
      .setFunctionName('showTaskEditor') 
      .setParameters({ 
        taskId: task.id, 
        taskListId: taskListId // FIXED: Now uses the dynamic list ID!
      }));
}