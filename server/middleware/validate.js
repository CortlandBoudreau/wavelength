// Lightweight input validation — no dependencies needed

const VALID_CATEGORIES = new Set([
  // Ocean / waves theme
  'marine_science', 'coral_reefs', 'deep_sea', 'conservation', 'ecology',
  'coastal_science', 'ocean_chemistry', 'polar_science', 'aquaculture',
  'plastic_pollution', 'biodiversity', 'ocean_tech', 'wildlife',
  'cool_facts', 'climate', 'environment', 'diversity_stem',
  // Legacy
  'space', 'science', 'biology', 'physics', 'technology',
  'medicine', 'health_science', 'chemistry', 'general',
]);
const VALID_ANGLES = new Set(['educational', 'inspiring', 'surprising', 'trending']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HASHTAG_RE = /^#[a-zA-Z0-9_]{1,49}$/;

function err(res, msg, status = 400) {
  return res.status(status).json({ error: msg });
}

// Validate a UUID path param — call early in route handlers
function validateUUID(id, res) {
  if (!UUID_RE.test(id)) {
    err(res, 'Invalid ID format');
    return false;
  }
  return true;
}

// Auth route validators
function validateRegister(req, res, next) {
  const { email, name, password } = req.body;
  if (!email || !name || !password) return err(res, 'email, name, and password are required');
  if (!EMAIL_RE.test(email)) return err(res, 'Invalid email address');
  if (name.length < 1 || name.length > 80) return err(res, 'Name must be 1–80 characters');
  if (password.length < 8) return err(res, 'Password must be at least 8 characters');
  if (password.length > 128) return err(res, 'Password too long');
  if (!/\d/.test(password)) return err(res, 'Password must contain at least one number');
  if (!/[^a-zA-Z0-9]/.test(password)) return err(res, 'Password must contain at least one special character');
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) return err(res, 'email and password are required');
  if (!EMAIL_RE.test(email)) return err(res, 'Invalid email address');
  if (password.length > 128) return err(res, 'Invalid credentials');
  next();
}

function validateProfileUpdate(req, res, next) {
  const { name, interests, hashtag_includes, hashtag_excludes } = req.body;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.length < 1 || name.length > 80)
      return err(res, 'Name must be 1–80 characters');
  }
  if (interests !== undefined) {
    if (!Array.isArray(interests)) return err(res, 'interests must be an array');
    if (interests.some((c) => !VALID_CATEGORIES.has(c)))
      return err(res, 'Invalid category in interests');
  }
  for (const [field, arr] of [['hashtag_includes', hashtag_includes], ['hashtag_excludes', hashtag_excludes]]) {
    if (arr !== undefined) {
      if (!Array.isArray(arr)) return err(res, `${field} must be an array`);
      if (arr.length > 50) return err(res, `${field} exceeds 50 tags`);
      if (arr.some((t) => !HASHTAG_RE.test(t)))
        return err(res, `${field} contains an invalid hashtag (use #word format, max 50 chars)`);
    }
  }
  next();
}

// Story interaction validators
function validateNotes(req, res, next) {
  const { notes, tags } = req.body;
  if (notes !== undefined && typeof notes !== 'string')
    return err(res, 'notes must be a string');
  if (notes && notes.length > 5000)
    return err(res, 'Notes exceed 5000 character limit');
  if (tags !== undefined) {
    if (!Array.isArray(tags)) return err(res, 'tags must be an array');
    if (tags.length > 20) return err(res, 'Too many tags (max 20)');
    if (tags.some((t) => typeof t !== 'string' || t.length > 50))
      return err(res, 'Each tag must be a string under 50 characters');
  }
  next();
}

function validatePasswordReset(req, res, next) {
  const { email, otp, password } = req.body;
  if (!email || !otp || !password) return err(res, 'email, otp, and password are required');
  if (!EMAIL_RE.test(email)) return err(res, 'Invalid email address');
  if (!/^\d{6}$/.test(String(otp))) return err(res, 'Invalid code');
  if (password.length < 8) return err(res, 'Password must be at least 8 characters');
  if (password.length > 128) return err(res, 'Password too long');
  next();
}

module.exports = {
  validateUUID,
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validateNotes,
  validatePasswordReset,
  VALID_CATEGORIES,
  VALID_ANGLES,
};
