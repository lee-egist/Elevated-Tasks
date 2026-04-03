/**
 * addon_handlers.js
 * Handles click events, triggers, and routing for the Google Workspace Add-on Sidebar.
 * Refactored for Multi-Tenant Supabase Architecture.
 */

/**
 * Helper to fetch the user's default organization for the Add-on.
 * @returns {string|null} The Org UUID or null.
 */
function getDefaultOrgId_() {
  const orgs = dbGetMyOrganizations();
  if (orgs && orgs.length > 0) {
    return orgs[0].organizations.id;
  }
  return null;
}

/**
 * Triggered when the user opens the Add-on (defined in appsscript.json).
 */
function onHomepage(e) {
  // Validate Profile and Organization before rendering
  const profile = dbCheckMyProfile();
  if (!profile) {
    return buildProfileSetupCard(); // Assumes you have a UI card for this
  }

  const orgId = getDefaultOrgId_();
  if (!orgId) {
    return buildNoOrganizationCard(); // Assumes you have a UI card for this
  }

  // Pass the orgId to your UI builder so it knows what projects to load
  return buildDashboardCard(e, orgId);
}

/**
 * Triggered when a user clicks a task row. 
 */
function showTaskEditor(e) {
  const card = buildTaskCard(e); // Assuming buildTaskCard handles orgId state internally
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

/**
 * Action handler for Quick Create from the dashboard.
 */
function handleCreateFromHome(e) {
  const formInputs = e.commonEventObject.formInputs;
  const orgId = getDefaultOrgId_();
  
  if (!orgId) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Error: No active organization."))
      .build();
  }

  const title = formInputs.new_task_title ? formInputs.new_task_title.stringInputs.value[0] : "Untitled Task";
  
  let projectId = formInputs.new_task_project_id ? formInputs.new_task_project_id.stringInputs.value[0] : "none";
  if (projectId === "none" || !projectId) {
     return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Error: Project selection is required."))
      .build();
  }

  const payload = {
    title: title,
    status: "open",
    priority: "medium",
    type: "general"
  };

  try {
    dbCreateTask(orgId, projectId, payload);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Task created successfully!"))
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(buildDashboardCard(e, orgId)))
      .build();
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Failed: " + err.message))
      .build();
  }
}

/**
 * Action handler for updating a task from the detailed editor card.
 */
function handleUpdateTask(e) {
  const formInputs = e.commonEventObject.formInputs;
  const actionParams = e.commonEventObject.parameters;
  const taskId = actionParams.taskId;
  const orgId = actionParams.orgId || getDefaultOrgId_(); // Pass this via action parameters in buildTaskCard!

  if (!orgId) throw new Error("No organization context.");

  // Strict schema payload parsing
  let blockedBy = formInputs.task_blocked_by ? formInputs.task_blocked_by.stringInputs.value[0] : "none";

  const payload = {
    title: formInputs.task_title ? formInputs.task_title.stringInputs.value[0] : "",
    description: formInputs.task_description ? formInputs.task_description.stringInputs.value[0] : "",
    assignee: formInputs.task_assignee ? formInputs.task_assignee.stringInputs.value[0] : null,
    status: formInputs.task_status ? formInputs.task_status.stringInputs.value[0] : "open",
    priority: formInputs.task_priority ? formInputs.task_priority.stringInputs.value[0] : "medium",
    type: formInputs.task_type ? formInputs.task_type.stringInputs.value[0] : "general",
    blocked_by: (blockedBy === "none") ? null : blockedBy,
    estimated_hours: formInputs.task_estimated_hours ? parseFloat(formInputs.task_estimated_hours.stringInputs.value[0]) : 0
  };

  // Convert milliseconds back to YYYY-MM-DD for Supabase
  if (formInputs.task_start_date) {
    payload.start_date = new Date(parseInt(formInputs.task_start_date.dateInput.msSinceEpoch)).toISOString().split('T')[0];
  }
  if (formInputs.task_due_date) {
    payload.due_date = new Date(parseInt(formInputs.task_due_date.dateInput.msSinceEpoch)).toISOString().split('T')[0];
  }

  try {
    dbUpdateTask(orgId, taskId, payload);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Task updated!"))
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(buildDashboardCard(e, orgId)))
      .build();
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Failed to update: " + err.message))
      .build();
  }
}

/**
 * Action handler for the "Save" button on the Task Detail/Editor card.
 * Extracts form inputs and updates the task in the Multi-Tenant database.
 * * @param {GoogleAppsScript.Addons.EventObject} e - The Google Workspace Add-on event object.
 * @returns {GoogleAppsScript.Card_Service.ActionResponse}
 */
function handleSave(e) {
  const formInputs = e.commonEventObject.formInputs;
  const actionParams = e.commonEventObject.parameters;
  
  // Extract context parameters passed from the UI builder
  const taskId = actionParams.taskId;
  const orgId = actionParams.orgId;

  if (!orgId || !taskId) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Error: Missing Organization or Task ID."))
      .build();
  }

  try {
    // 1. Sanitize the blocked_by dropdown
    let blockedBy = formInputs.task_blocked_by ? formInputs.task_blocked_by.stringInputs.value[0] : "none";

    // 2. Build the strict payload for Supabase
    /** @type {Record<string, any>} */
    const payload = {
      title: formInputs.task_title ? formInputs.task_title.stringInputs.value[0] : "",
      description: formInputs.task_description ? formInputs.task_description.stringInputs.value[0] : "",
      assignee: formInputs.task_assignee ? formInputs.task_assignee.stringInputs.value[0] : null,
      status: formInputs.task_status ? formInputs.task_status.stringInputs.value[0] : "open",
      priority: formInputs.task_priority ? formInputs.task_priority.stringInputs.value[0] : "medium",
      type: formInputs.task_type ? formInputs.task_type.stringInputs.value[0] : "general",
      blocked_by: (blockedBy === "none" || blockedBy === "") ? null : blockedBy,
      estimated_hours: formInputs.task_estimated_hours ? parseFloat(formInputs.task_estimated_hours.stringInputs.value[0]) : 0
    };

    // 3. Convert Google's DatePicker milliseconds (msSinceEpoch) back to YYYY-MM-DD
    if (formInputs.task_start_date && formInputs.task_start_date.dateInput) {
      payload.start_date = new Date(parseInt(formInputs.task_start_date.dateInput.msSinceEpoch))
        .toISOString().split('T')[0];
    }
    if (formInputs.task_due_date && formInputs.task_due_date.dateInput) {
      payload.due_date = new Date(parseInt(formInputs.task_due_date.dateInput.msSinceEpoch))
        .toISOString().split('T')[0];
    }

    // 4. Update via the new Service Class
    TaskService.update(orgId, taskId, payload);

    // 5. Notify the user and refresh the UI
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Task updated successfully!"))
      // Assuming buildDashboardCard accepts the event and orgId to re-render the home screen
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(buildDashboardCard(e, orgId)))
      .build();

  } catch (err) {
    console.error("handleSave Error: " + err);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Failed to save: " + err.message))
      .build();
  }
}