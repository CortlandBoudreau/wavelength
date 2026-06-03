/**
 * Unit tests for input validation middleware (validate.js).
 * Middleware functions are tested with lightweight req/res/next mocks.
 */

const {
  validateUUID,
  validateRegister,
  validateLogin,
  validateNotes,
  validatePasswordReset,
  VALID_CATEGORIES,
} = require('../middleware/validate');

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(body = {}) {
  return { body };
}

// ── validateUUID ──────────────────────────────────────────────────────────────

describe('validateUUID', () => {
  test('accepts a valid v4 UUID', () => {
    const res = mockRes();
    expect(validateUUID('550e8400-e29b-41d4-a716-446655440000', res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('rejects a plain string', () => {
    const res = mockRes();
    expect(validateUUID('not-a-uuid', res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects an empty string', () => {
    const res = mockRes();
    expect(validateUUID('', res)).toBe(false);
  });

  test('rejects a v1 UUID', () => {
    const res = mockRes();
    // v1 UUID has version nibble = 1, not 4
    expect(validateUUID('550e8400-e29b-11d4-a716-446655440000', res)).toBe(false);
  });
});

// ── validateRegister ──────────────────────────────────────────────────────────

describe('validateRegister', () => {
  const next = jest.fn();

  beforeEach(() => next.mockClear());

  test('passes valid registration data', () => {
    const res = mockRes();
    validateRegister(mockReq({ email: 'user@example.com', name: 'Alice', password: 'secure123' }), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('rejects missing email', () => {
    const res = mockRes();
    validateRegister(mockReq({ name: 'Alice', password: 'secure123' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects invalid email format', () => {
    const res = mockRes();
    validateRegister(mockReq({ email: 'not-an-email', name: 'Alice', password: 'secure123' }), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects password shorter than 8 chars', () => {
    const res = mockRes();
    validateRegister(mockReq({ email: 'user@example.com', name: 'Alice', password: 'short' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('8') }));
  });

  test('rejects password longer than 128 chars', () => {
    const res = mockRes();
    validateRegister(mockReq({ email: 'user@example.com', name: 'Alice', password: 'a'.repeat(129) }), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects name longer than 80 chars', () => {
    const res = mockRes();
    validateRegister(mockReq({ email: 'user@example.com', name: 'a'.repeat(81), password: 'secure123' }), res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── validateLogin ─────────────────────────────────────────────────────────────

describe('validateLogin', () => {
  const next = jest.fn();

  beforeEach(() => next.mockClear());

  test('passes valid login data', () => {
    const res = mockRes();
    validateLogin(mockReq({ email: 'user@example.com', password: 'anything' }), res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects missing password', () => {
    const res = mockRes();
    validateLogin(mockReq({ email: 'user@example.com' }), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects invalid email', () => {
    const res = mockRes();
    validateLogin(mockReq({ email: 'bad', password: 'pw' }), res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── validateNotes ─────────────────────────────────────────────────────────────

describe('validateNotes', () => {
  const next = jest.fn();

  beforeEach(() => next.mockClear());

  test('passes with valid notes', () => {
    const res = mockRes();
    validateNotes(mockReq({ notes: 'Great story!' }), res, next);
    expect(next).toHaveBeenCalled();
  });

  test('passes with no notes field (optional)', () => {
    const res = mockRes();
    validateNotes(mockReq({}), res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects notes over 5000 chars', () => {
    const res = mockRes();
    validateNotes(mockReq({ notes: 'a'.repeat(5001) }), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects non-string notes', () => {
    const res = mockRes();
    validateNotes(mockReq({ notes: 42 }), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects tags array exceeding 20 items', () => {
    const res = mockRes();
    validateNotes(mockReq({ tags: Array.from({ length: 21 }, (_, i) => `tag${i}`) }), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects tags with items over 50 chars', () => {
    const res = mockRes();
    validateNotes(mockReq({ tags: ['a'.repeat(51)] }), res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── validatePasswordReset ─────────────────────────────────────────────────────

describe('validatePasswordReset', () => {
  const next = jest.fn();

  beforeEach(() => next.mockClear());

  test('passes valid reset data', () => {
    const res = mockRes();
    validatePasswordReset(mockReq({ email: 'user@example.com', otp: '123456', password: 'newpass1' }), res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects non-6-digit OTP', () => {
    const res = mockRes();
    validatePasswordReset(mockReq({ email: 'user@example.com', otp: '12345', password: 'newpass1' }), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects OTP with letters', () => {
    const res = mockRes();
    validatePasswordReset(mockReq({ email: 'user@example.com', otp: '12345a', password: 'newpass1' }), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects password shorter than 8 chars', () => {
    const res = mockRes();
    validatePasswordReset(mockReq({ email: 'user@example.com', otp: '123456', password: 'short' }), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects missing fields', () => {
    const res = mockRes();
    validatePasswordReset(mockReq({ email: 'user@example.com' }), res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── VALID_CATEGORIES ──────────────────────────────────────────────────────────

describe('VALID_CATEGORIES', () => {
  test('includes core ocean categories', () => {
    expect(VALID_CATEGORIES.has('marine_science')).toBe(true);
    expect(VALID_CATEGORIES.has('coral_reefs')).toBe(true);
    expect(VALID_CATEGORIES.has('deep_sea')).toBe(true);
  });

  test('includes general science categories', () => {
    expect(VALID_CATEGORIES.has('space')).toBe(true);
    expect(VALID_CATEGORIES.has('climate')).toBe(true);
    expect(VALID_CATEGORIES.has('health_science')).toBe(true);
  });

  test('rejects unknown categories', () => {
    expect(VALID_CATEGORIES.has('sports')).toBe(false);
    expect(VALID_CATEGORIES.has('')).toBe(false);
    expect(VALID_CATEGORIES.has('MARINE_SCIENCE')).toBe(false); // case-sensitive
  });
});
