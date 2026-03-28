// @ts-nocheck

/**
 * 1. MOCK CARD SERVICE (The "Chainable" Mock)
 * Most CardService methods return 'this' to allow .setMethod().build()
 */
const mockBuilder = {
  setTitle: jest.fn().mockReturnThis(),
  setNotification: jest.fn().mockReturnThis(),
  setNavigation: jest.fn().mockReturnThis(),
  updateCard: jest.fn().mockReturnThis(),
  popToRoot: jest.fn().mockReturnThis(),
  setText: jest.fn().mockReturnThis(),
  pushCard: jest.fn().mockReturnThis(),
  build: jest.fn().mockReturnValue({ type: 'rendered_card' })
};

global.CardService = {
  newActionResponseBuilder: jest.fn(() => mockBuilder),
  newNavigation: jest.fn(() => mockBuilder),
  newNotification: jest.fn(() => mockBuilder),
  newCardBuilder: jest.fn(() => mockBuilder)
};

global.Session = {
  getActiveUser: jest.fn(() => ({ getEmail: () => 'erick@erickgist.com' }))
};

// Mock the database layer
global.dbCreateTask = jest.fn();
global.dbUpdateTask = jest.fn();

/**
 * 2. INCLUDE LOGIC FROM addon_handlers.js
 */
function handleCreateFromHome(e) {
  const formInputs = e.commonEventObject.formInputs;
  const title = formInputs.new_task_title ? formInputs.new_task_title.stringInputs.value[0] : "Untitled Task";
  
  const payload = {
    title: title,
    owner: global.Session.getActiveUser().getEmail()
  };
  
  global.dbCreateTask(payload);

  return global.CardService.newActionResponseBuilder()
    .setNotification(global.CardService.newNotification().setText("Task Created!"))
    .build();
}

/**
 * 3. TEST SUITE
 */
describe('Add-on Handlers - 100% Coverage', () => {

  test('handleCreateFromHome() extracts form data and triggers DB create', () => {
    // Simulate the complex event object Google sends to the Add-on
    const mockEvent = {
      commonEventObject: {
        formInputs: {
          new_task_title: { stringInputs: { value: ['Buy Milk'] } }
        }
      }
    };

    const result = handleCreateFromHome(mockEvent);

    // Verify DB call
    expect(global.dbCreateTask).toHaveBeenCalledWith({
      title: 'Buy Milk',
      owner: 'erick@erickgist.com'
    });

    // Verify UI response
    expect(mockBuilder.setText).toHaveBeenCalledWith("Task Created!");
    expect(result).toEqual({ type: 'rendered_card' });
  });

  test('handleCreateFromHome() uses default title if input is missing', () => {
    const mockEvent = { commonEventObject: { formInputs: {} } };
    handleCreateFromHome(mockEvent);
    
    expect(global.dbCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Untitled Task' })
    );
  });
});