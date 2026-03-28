const { getCleanNotes } = require('../backend/utils');

describe('Utils', () => {
  test('getCleanNotes strips metadata', () => {
    const raw = '{"status":"open"} ||| Real Note';
    expect(getCleanNotes(raw)).toBe('Real Note');
  });
});