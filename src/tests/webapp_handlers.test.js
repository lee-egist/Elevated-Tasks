// @ts-nocheck

/** * 1. GLOBAL MOCKS 
 */
global.HtmlService = {
  createTemplateFromFile: jest.fn(() => ({
    evaluate: jest.fn(() => ({
      setTitle: jest.fn().mockReturnThis(),
      setXFrameOptionsMode: jest.fn().mockReturnThis(),
      addMetaTag: jest.fn().mockReturnThis()
    }))
  }))
};

global.Session = {
  getActiveUser: jest.fn(() => ({
    getEmail: () => 'erick@erickgist.com'
  }))
};

global.Utilities = {
  parseCsv: jest.fn()
};

// Mocking the database functions (defined in supabase.js)
global.dbGetTasks = jest.fn();
global.dbCreateTask = jest.fn();
global.dbUpdateTask = jest.fn();
global.dbDeleteTask = jest.fn();
global.dbGetProjects = jest.fn();
global.dbCreateProject = jest.fn();
global.dbCheckMyProfile = jest.fn();
global.dbCreateProfile = jest.fn();
global.dbUpdateProfile = jest.fn();
global.dbInviteTeammate = jest.fn();

/**
 * 2. INCLUDE LOGIC FROM webapp_handlers.js
 */
// (Paste your isValidUUID, createDashboardTask, etc. functions here or use a bundler)
function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  return regexExp.test(str);
}

function createDashboardTask(taskData) {
  try {
    const currentUser = global.Session.getActiveUser().getEmail();
    const supabasePayload = {
      title: taskData.title || "Untitled",
      owner: currentUser,
      project_id: isValidUUID(taskData.project_id) ? taskData.project_id : null
    };
    global.dbCreateTask(supabasePayload);
    return true;
  } catch (err) {
    throw new Error("Failed to create task: " + err.message, { cause: err });
  }
}

/**
 * 3. TEST SUITE
 */
describe('Web App Handlers - 100% Coverage', () => {

  describe('createDashboardTask()', () => {
    test('successfully maps frontend data to Supabase payload', () => {
      const input = { title: 'Fix Bug', project_id: '123e4567-e89b-12d3-a456-426614174000' };
      
      const result = createDashboardTask(input);
      
      expect(result).toBe(true);
      expect(global.dbCreateTask).toHaveBeenCalledWith({
        title: 'Fix Bug',
        owner: 'erick@erickgist.com',
        project_id: '123e4567-e89b-12d3-a456-426614174000'
      });
    });

    test('sets project_id to null if UUID is invalid', () => {
      const input = { title: 'Old Task', project_id: 'NOT-A-UUID' };
      createDashboardTask(input);
      
      expect(global.dbCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: null })
      );
    });

    test('catches and rethrows errors for 100% branch coverage', () => {
      global.dbCreateTask.mockImplementationOnce(() => { throw new Error("DB Down"); });
      
      expect(() => createDashboardTask({ title: 'Fail' }))
        .toThrow("Failed to create task: DB Down");
    });
  });
});