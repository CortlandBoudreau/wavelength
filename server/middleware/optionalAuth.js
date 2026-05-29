const jwt = require('jsonwebtoken');

// Like requireAuth but never blocks — just attaches req.user if token is valid
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    } catch {
      // Invalid token — treat as guest, don't block
    }
  }
  next();
}

module.exports = { optionalAuth };
