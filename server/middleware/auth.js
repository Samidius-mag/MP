const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Используем только переменную окружения
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Проверяем, что пользователь существует и активен
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, email, role, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      if (!user.is_active) {
        return res.status(401).json({ error: 'User account is disabled' });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role
      };

      next();
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const requireClient = requireRole(['client']);
const requireOperator = requireRole(['operator']);
const requireAdmin = requireRole(['admin']);

module.exports = {
  authenticateToken,
  requireRole,
  requireClient,
  requireOperator,
  requireAdmin
};



