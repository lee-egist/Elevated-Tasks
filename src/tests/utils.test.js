// We need to simulate the function since it's not exported as a Node module
// In a real GAS project, you'd export these, but we can just copy the pure function here for the test,
// or use a bundler. For now, let's define the pure function we want to test:

function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  return regexExp.test(str);
}

describe('isValidUUID', () => {
  it('should return true for a valid Supabase UUID', () => {
    expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('should return false for old Google Task IDs', () => {
    expect(isValidUUID('MTEzNDU2Nzg5')).toBe(false);
  });

  it('should return false for null, undefined, or empty strings', () => {
    expect(isValidUUID(null)).toBe(false);
    expect(isValidUUID(undefined)).toBe(false);
    expect(isValidUUID('')).toBe(false);
  });
});