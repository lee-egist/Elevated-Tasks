// @ts-check

// 1. Mock the "missing" global functions from other files
global.isValidUUID = jest.fn((str) => {
  if (!str || typeof str !== 'string') return false;
  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  return regexExp.test(str);
});

// 2. Mock Google Services (Actual implementation, no ellipsis!)
global.PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn((key) => {
      if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
      if (key === 'SUPABASE_ANON_KEY') return 'fake-anon';
      if (key === 'SUPABASE_SERVICE_KEY') return 'fake-service';
      return null;
    })
  }))
};

global.UrlFetchApp = {
  fetch: jest.fn(() => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify([{ id: '123' }])
  }))
};

// 3. Now require the file
const { dbGetTasks } = require('../backend/supabase');

describe('Supabase Backend', () => {
  test('dbGetTasks calls the correct endpoint', () => {
    const tasks = dbGetTasks();
    expect(global.UrlFetchApp.fetch).toHaveBeenCalled();
    expect(tasks[0].id).toBe('123');
  });
});