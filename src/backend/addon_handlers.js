/**
 * addon_handlers.js
 * Handles click events and routing specifically for the Google Workspace Add-on Sidebar.
 */

function onHomepage(e) {
  let taskListId = (e && e.formInput && e.formInput.selected_task_list) 
    ? e.formInput.selected_task_list 
    : "@default";
    
  const availableLists = fetchAllTaskLists(); // Uses our new API function
  return buildDashboardCard(e, taskListId, availableLists);
}

function handleTaskListChange(e) {
  return CardService.newNavigation().updateCard(onHomepage(e));
}

function showTaskEditor(e) {
  return CardService.newNavigation().pushCard(buildTaskCard(e));
}

function handleCreateFromHome(e) {
  const title = e.formInput.new_task_title;
  const taskListId = e.formInput.selected_task_list || "@default";
  
  if (!title) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Title required."))
      .build();
  }

  const defaultMetadata = { status: "open", priority: "medium", updated_at: new Date().toISOString() };
  insertTask(taskListId, {
    title: title,
    notes: buildElevatedNotes("", defaultMetadata)
  });

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Task created!"))
    .setNavigation(CardService.newNavigation().updateCard(onHomepage(e)))
    .build();
}

function handleSave(e) {
  const taskId = e.parameters.taskId;
  const taskListId = e.parameters.taskListId;
  const formInputs = e.formInput;

  const metadata = {
    project: formInputs.project || "",
    assignee: formInputs.assignee || "",
    priority: formInputs.priority || "medium",
    status: formInputs.status || "open",
    type: formInputs.type || "general",
    start_date: formInputs.start_date || "",
    due_date: formInputs.due_date || "",
    blocked_by: formInputs.blocked_by || "",
    updated_at: new Date().toISOString()
  };

  const cleanNotes = formInputs.user_notes || "";
  const finalNotes = buildElevatedNotes(cleanNotes, metadata);

  updateTaskData(taskListId, taskId, formInputs.title, finalNotes);

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Task saved!"))
    .setNavigation(CardService.newNavigation().popToRoot().updateCard(onHomepage(e)))
    .build();
}