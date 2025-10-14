const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Регистрация
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('role').optional().isIn(['client', 'operator'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, role = 'client', phone, companyName } = req.body;

    const client = await pool.connect();
    try {
      // Проверяем, существует ли пользователь
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // Хешируем пароль
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Создаем пользователя
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name, role, created_at`,
        [email, passwordHash, firstName, lastName, phone, role]
      );

      const user = userResult.rows[0];

      // Если это клиент, создаем запись в таблице clients
      if (role === 'client') {
        await client.query(
          `INSERT INTO clients (user_id, company_name)
           VALUES ($1, $2)`,
          [user.id, companyName || null]
        );
      }

      // Генерируем JWT токен
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Вход
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const client = await pool.connect();
    try {
      // Находим пользователя
      const userResult = await client.query(
        'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is disabled' });
      }

      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Генерируем JWT токен
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Получение профиля пользователя
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const userResult = await client.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.created_at,
                c.company_name, c.inn, c.address, c.api_keys
         FROM users u
         LEFT JOIN clients c ON u.id = c.user_id
         WHERE u.id = $1`,
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        companyName: user.company_name,
        inn: user.inn,
        address: user.address,
        createdAt: user.created_at
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Обновление профиля
router.put('/profile', authenticateToken, [
  body('firstName').optional().notEmpty().trim(),
  body('lastName').optional().notEmpty().trim(),
  body('phone').optional().isMobilePhone('ru-RU'),
  body('companyName').optional().trim(),
  body('inn').optional().isLength({ min: 10, max: 12 }),
  body('address').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, phone, companyName, inn, address } = req.body;

    const client = await pool.connect();
    try {
      // Обновляем пользователя
      await client.query(
        `UPDATE users 
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             phone = COALESCE($3, phone),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [firstName, lastName, phone, req.user.id]
      );

      // Если это клиент, обновляем данные клиента
      if (req.user.role === 'client') {
        await client.query(
          `UPDATE clients 
           SET company_name = COALESCE($1, company_name),
               inn = COALESCE($2, inn),
               address = COALESCE($3, address),
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $4`,
          [companyName, inn, address, req.user.id]
        );
      }

      res.json({ message: 'Profile updated successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Смена пароля
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const client = await pool.connect();
    try {
      // Получаем текущий пароль
      const userResult = await client.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Проверяем текущий пароль
      const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Хешируем новый пароль
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Обновляем пароль
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPasswordHash, req.user.id]
      );

      res.json({ message: 'Password changed successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;


