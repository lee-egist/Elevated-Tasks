/**
 * addon_handlers.js
 * Handles click events, triggers, and routing for the Google Workspace Add-on Sidebar.
 */

/**
 * Triggered when the user opens the Add-on (defined in appsscript.json).
 */
function onHomepage(e) {
  // We no longer need to fetch Google Task Lists! 
  // Supabase handles the project grouping natively.
  return buildDashboardCard(e);
}

/**
 * Triggered when a user clicks a task row. 
 * Pushes the detailed task card onto the navigation stack.
 */
function showTaskEditor(e) {
  const card = buildTaskCard(e);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

/**
 * Action handler for Quick Create from the dashboard.
 */
function handleCreateFromHome(e) {
  const formInputs = e.commonEventObject.formInputs;
  const title = formInputs.new_task_title ? formInputs.new_task_title.stringInputs.value[0] : "Untitled Task";
  
  let projectId = formInputs.new_task_project_id ? formInputs.new_task_project_id.stringInputs.value[0] : "none";
  projectId = (projectId === "none") ? null : projectId;

  const payload = {
    title: title,
    project_id: projectId,
    status: "open",
    priority: "medium",
    owner: Session.getActiveUser().getEmail()
  };
  
  dbCreateTask(payload);

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Task Created in Database!"))
    .setNavigation(CardService.newNavigation().updateCard(buildDashboardCard(e)))
    .build();
}

/**
 * Action handler for the Save button in the editor.
 */
function handleSave(e) {
  const formInputs = e.commonEventObject.formInputs;
  const taskId = e.parameters.taskId;

  let projectId = formInputs.task_project_id ? formInputs.task_project_id.stringInputs.value[0] : "none";
  let blockedBy = formInputs.task_blocked_by ? formInputs.task_blocked_by.stringInputs.value[0] : "none";

  const payload = {
    title: formInputs.task_title ? formInputs.task_title.stringInputs.value[0] : "",
    description: formInputs.task_description ? formInputs.task_description.stringInputs.value[0] : "",
    project_id: (projectId === "none") ? null : projectId,
    assignee: formInputs.task_assignee ? formInputs.task_assignee.stringInputs.value[0] : null,
    status: formInputs.task_status ? formInputs.task_status.stringInputs.value[0] : "open",
    priority: formInputs.task_priority ? formInputs.task_priority.stringInputs.value[0] : "medium",
    type: formInputs.task_type ? formInputs.task_type.stringInputs.value[0] : "general",
    blocked_by: (blockedBy === "none") ? null : blockedBy
  };

  // Convert milliseconds back to YYYY-MM-DD for Supabase
  if (formInputs.task_start_date) {
    payload.start_date = new Date(parseInt(formInputs.task_start_date.dateInput.msSinceEpoch)).toISOString().split('T')[0];
  }
  if (formInputs.task_due_date) {
    payload.due_date = new Date(parseInt(formInputs.task_due_date.dateInput.msSinceEpoch)).toISOString().split('T')[0];
  }

  dbUpdateTask(taskId, payload);

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Database Updated!"))
    .setNavigation(CardService.newNavigation().popToRoot().updateCard(buildDashboardCard(e)))
    .build();
}