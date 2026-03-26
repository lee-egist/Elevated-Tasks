/**
 * ui.js
 * Strictly handles building CardService widgets and layouts for the Google Workspace Add-on.
 * Upgraded to use the Supabase database backend.
 */

/**
 * Builds the main dashboard card, grouped by projects.
 * Includes Quick Create and List Filtering.
 */
function buildDashboardCard(e) {
  const builder = CardService.newCardBuilder();

  builder.setHeader(CardService.newCardHeader()
    .setTitle("PM Dashboard")
    .setSubtitle("Connected to Supabase"));

  // =========================================
  // SECTION 1: CONTROLS & QUICK CREATE
  // =========================================
  const controlSection = CardService.newCardSection();

  // Web App Link
  const webAppUrl = "https://script.google.com/a/macros/ncnursingacademy.com/s/AKfycbxdw6DK860yYOZqRSRqy2ZYvug6aWm0qPTjMkC6gE6UH_c_RI7GcttZ7IGmjEGu2ynr/exec";
  controlSection.addWidget(CardService.newTextButton()
    .setText("🌐 Open Full Web Dashboard")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOpenLink(CardService.newOpenLink()
      .setUrl(webAppUrl)
      .setOpenAs(CardService.OpenAs.FULL_SIZE)
      .setOnClose(CardService.OnClose.NOTHING)));

  // If opening from an email, we can grab the subject line!
  let defaultTitle = "";
  if (e && e.messageMetadata && e.messageMetadata.accessToken) {
    // (Optional Future Enhancement: Fetch email subject using GmailApp here)
    defaultTitle = "New Task from Email";
  }

  controlSection.addWidget(CardService.newTextInput()
    .setFieldName("new_task_title")
    .setTitle("New Task Title")
    .setValue(defaultTitle));

  // Fetch Projects from Supabase for the Dropdown
  const projects = dbGetProjects() || [];
  const projectDropdown = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Assign to Project")
    .setFieldName("new_task_project_id")
    .addItem("-- Unassigned --", "none", true);

  projects.forEach(p => {
    projectDropdown.addItem(p.name, p.id, false);
  });
  controlSection.addWidget(projectDropdown);

  controlSection.addWidget(CardService.newTextButton()
    .setText("➕ Quick Create Task")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction().setFunctionName("handleCreateFromHome")));

  builder.addSection(controlSection);

  // =========================================
  // SECTION 2: TASK TREE (Grouped by Project)
  // =========================================

  // 1. Fetch ALL tasks from Supabase
  const tasks = dbGetTasks() || [];

  // 2. Group them by Project Name
  const groupedProjects = {};
  tasks.forEach(task => {
    // Because we used 'select=*,projects(name)' in supabase.js, the project name is nested
    const projectName = (task.projects && task.projects.name) ? task.projects.name : "Unassigned";
    if (!groupedProjects[projectName]) groupedProjects[projectName] = [];
    groupedProjects[projectName].push(task);
  });

  const sortedProjectNames = Object.keys(groupedProjects).sort();

  if (sortedProjectNames.length === 0) {
    builder.addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText("No tasks found in the database.")));
    return builder.build();
  }

  // 3. Build the UI Sections for each project
  sortedProjectNames.forEach(projectName => {
    const projectSection = CardService.newCardSection().setHeader(`📁 ${projectName}`);
    const tasksInProject = groupedProjects[projectName];

    tasksInProject.forEach(task => {
      projectSection.addWidget(createTaskRowWidget(task));
    });

    builder.addSection(projectSection);
  });

  return builder.build();
}

/**
 * Builds the detailed editor card for a specific task.
 */
function buildTaskCard(e) {
  const taskId = e.parameters.taskId;

  if (!taskId) {
    return CardService.newCardBuilder()
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText("⚠️ Error: No Task ID provided.")))
      .build();
  }

  // Fetch all tasks and find the specific one, plus fetch projects
  const allTasks = dbGetTasks() || [];
  const task = allTasks.find(t => t.id === taskId);
  const projectList = dbGetProjects() || [];

  if (!task) {
    return CardService.newCardBuilder()
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText("⚠️ Task not found in database.")))
      .build();
  }

  // Fetch workspace users for Assignee autocomplete (Assumes getWorkspaceUsers still exists in utils.js)
  let userEmails = [];
  try {
    const workspaceUsers = getWorkspaceUsers();
    userEmails = workspaceUsers.map(u => u.email);
  } catch (err) {
    console.warn("Could not load workspace users." + err.message);
  }

  const currentUserEmail = Session.getActiveUser().getEmail();
  const detailSection = CardService.newCardSection().setHeader("Task Details");

  // Title & Description
  detailSection.addWidget(CardService.newTextInput()
    .setFieldName("task_title")
    .setTitle("Task Title")
    .setValue(task.title || ""));

  detailSection.addWidget(CardService.newTextInput()
    .setFieldName("task_description")
    .setTitle("Task Description")
    .setMultiline(true)
    .setValue(task.description || ""));

  // Project Dropdown
  const projectDropdown = CardService.newSelectionInput()
    .setFieldName("task_project_id")
    .setTitle("Project / Initiative")
    .setType(CardService.SelectionInputType.DROPDOWN)
    .addItem("-- Unassigned --", "none", !task.project_id);

  projectList.forEach(proj => {
    projectDropdown.addItem(proj.name, proj.id, task.project_id === proj.id);
  });
  detailSection.addWidget(projectDropdown);

  // Assignee
  const assigneeInput = CardService.newTextInput()
    .setFieldName("task_assignee")
    .setTitle("Assignee (Email)")
    .setValue(task.assignee || currentUserEmail);

  if (userEmails.length > 0) {
    assigneeInput.setSuggestions(CardService.newSuggestions().addSuggestions(userEmails));
  }
  detailSection.addWidget(assigneeInput);

  // Status & Priority
  detailSection.addWidget(CardService.newSelectionInput()
    .setFieldName("task_status")
    .setTitle("Current Status")
    .setType(CardService.SelectionInputType.DROPDOWN)
    .addItem("Open", "open", task.status === "open" || !task.status)
    .addItem("In Progress", "in_progress", task.status === "in_progress")
    .addItem("Blocked", "blocked", task.status === "blocked")
    .addItem("Completed", "completed", task.status === "completed"));

  detailSection.addWidget(CardService.newSelectionInput()
    .setFieldName("task_priority")
    .setTitle("Priority")
    .setType(CardService.SelectionInputType.DROPDOWN)
    .addItem("Low", "low", task.priority === "low")
    .addItem("Medium", "medium", task.priority === "medium" || !task.priority)
    .addItem("High", "high", task.priority === "high")
    .addItem("Critical", "critical", task.priority === "critical"));

  // Type
  detailSection.addWidget(CardService.newSelectionInput()
    .setFieldName("task_type")
    .setTitle("Task Type")
    .setType(CardService.SelectionInputType.DROPDOWN)
    .addItem("General", "general", task.type === "general" || !task.type)
    .addItem("Bug", "bug", task.type === "bug")
    .addItem("Feature", "feature", task.type === "feature")
    .addItem("Milestone", "milestone", task.type === "milestone"));

  // Dates (Convert Supabase YYYY-MM-DD to milliseconds for the Google UI)
  const startPicker = CardService.newDatePicker().setFieldName("task_start_date").setTitle("Start Date");
  if (task.start_date) {
    startPicker.setValueInMsSinceEpoch(new Date(task.start_date).getTime());
  }
  detailSection.addWidget(startPicker);

  const duePicker = CardService.newDatePicker().setFieldName("task_due_date").setTitle("Due Date");
  if (task.due_date) {
    duePicker.setValueInMsSinceEpoch(new Date(task.due_date).getTime());
  }
  detailSection.addWidget(duePicker);

  // Blocked By Dropdown (Massive UX Improvement!)
  const blockedDropdown = CardService.newSelectionInput()
    .setFieldName("task_blocked_by")
    .setTitle("Blocked By...")
    .setType(CardService.SelectionInputType.DROPDOWN)
    .addItem("-- Not Blocked --", "none", !task.blocked_by);

  allTasks.forEach(t => {
    if (t.id !== task.id && t.status !== 'completed') {
      blockedDropdown.addItem(t.title, t.id, task.blocked_by === t.id);
    }
  });
  detailSection.addWidget(blockedDropdown);

  // Save Button
  detailSection.addWidget(CardService.newTextButton()
    .setText("💾 SAVE CHANGES")
    .setOnClickAction(CardService.newAction()
      .setFunctionName('handleSave')
      .setParameters({ taskId: taskId }))
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED));

  return CardService.newCardBuilder()
    .addSection(detailSection)
    .build();
}

/**
 * Helper to generate a consistent UI row for a task.
 */
function createTaskRowWidget(task) {
  const iconUrl = task.status === "completed"
    ? "https://fonts.gstatic.com/s/i/googlematerialicons/check_circle/v6/24px.svg"
    : "https://fonts.gstatic.com/s/i/googlematerialicons/radio_button_unchecked/v6/24px.svg";

  return CardService.newDecoratedText()
    .setText(task.title)
    .setBottomLabel(task.status || "open")
    .setStartIcon(CardService.newIconImage().setIconUrl(iconUrl))
    .setOnClickAction(CardService.newAction()
      .setFunctionName('showTaskEditor')
      .setParameters({ taskId: task.id }));
}