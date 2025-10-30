const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const verificationService = require('../services/verification');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Валидация пароля
const passwordValidation = (password) => {
  const minLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!minLength) return 'Пароль должен содержать минимум 8 символов';
  if (!hasUpperCase) return 'Пароль должен содержать минимум одну заглавную букву';
  if (!hasSpecialChar) return 'Пароль должен содержать минимум один спецсимвол';
  return true;
};

// Регистрация - шаг 1: создание пользователя
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Неверный формат email'),
  body('password').custom(passwordValidation),
  body('firstName').notEmpty().trim().withMessage('Имя обязательно'),
  body('lastName').notEmpty().trim().withMessage('Фамилия обязательна'),
  body('phone').isMobilePhone('ru-RU').withMessage('Неверный формат телефона'),
  body('inn').isLength({ min: 10, max: 12 }).withMessage('ИНН должен содержать 10-12 цифр'),
  body('companyData').notEmpty().withMessage('Данные компании обязательны'),
  body('termsAccepted').equals('true').withMessage('Необходимо согласие с офертой')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      phone, 
      inn,
      companyData,
      termsAccepted 
    } = req.body;

    const client = await pool.connect();
    try {
      // Проверяем, существует ли пользователь
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1 OR phone = $2',
        [email, phone]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Пользователь с таким email или телефоном уже существует' });
      }

      // Проверяем, не зарегистрирована ли уже компания с этим ИНН
      const existingCompany = await client.query(
        'SELECT id FROM clients WHERE inn = $1',
        [inn]
      );

      if (existingCompany.rows.length > 0) {
        return res.status(409).json({ error: 'Компания с таким ИНН уже зарегистрирована' });
      }

      // Хешируем пароль
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Создаем пользователя (все по умолчанию клиенты)
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified, phone_verified)
         VALUES ($1, $2, $3, $4, $5, 'client', false, true)
         RETURNING id, email, first_name, last_name, phone, role, created_at`,
        [email, passwordHash, firstName, lastName, phone]
      );

      const user = userResult.rows[0];

      // Создаем запись в таблице clients с данными компании
      const fnsVerified = companyData.status && !companyData.status.includes('Не проверено');
      await client.query(
        `INSERT INTO clients (user_id, company_name, company_form, inn, ogrn, fns_verified, terms_accepted, terms_accepted_date)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW())`,
        [user.id, companyData.name, companyData.form, companyData.inn, companyData.ogrn, fnsVerified]
      );

      // Генерируем код верификации для email
      const emailCode = verificationService.generateVerificationCode();

      // Сохраняем код
      await verificationService.saveVerificationCode(user.id, emailCode, 'email', { pool });

      // Отправляем код
      await verificationService.sendEmailVerification(email, emailCode);

      res.status(201).json({
        message: 'Пользователь создан. Проверьте email для подтверждения.',
        userId: user.id,
        requiresVerification: true
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

// Подтверждение email
router.post('/verify-email', [
  body('userId').isInt().withMessage('Неверный ID пользователя'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Код должен содержать 6 цифр')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, code } = req.body;

    const client = await pool.connect();
    try {
      // Проверяем код
      const verification = await verificationService.verifyCode(userId, code, 'email', { pool });
      if (!verification.success) {
        return res.status(400).json({ error: verification.error });
      }

      // Обновляем статус верификации
      await client.query(
        'UPDATE users SET email_verified = true WHERE id = $1',
        [userId]
      );

      // Генерируем JWT токен для полной авторизации
      const token = jwt.sign(
        { userId, email: req.body.email, role: 'client' },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '14d' }
      );

      res.json({
        message: 'Регистрация завершена успешно',
        token,
        user: {
          id: userId,
          email: req.body.email,
          role: 'client'
        }
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ error: 'Ошибка подтверждения email' });
  }
});


// Проверка компании по ИНН
router.post('/check-company', [
  body('inn').isLength({ min: 10, max: 12 }).withMessage('ИНН должен содержать 10-12 цифр')
], async (req, res) => {
  try {
    const { inn } = req.body;

    // Определяем форму компании по длине ИНН
    const companyForm = inn.length === 10 ? 'IP' : 'OOO';

    // Проверяем компанию через API ФНС
    const verification = await verificationService.verifyINN(inn, companyForm);
    
    if (!verification.success) {
      return res.status(400).json({ error: verification.error });
    }

    res.json({
      message: 'Компания найдена и проверена',
      data: verification.data
    });
  } catch (err) {
    console.error('Company check error:', err);
    res.status(500).json({ error: 'Ошибка проверки компании' });
  }
});

// Повторная отправка кода
router.post('/resend-code', [
  body('userId').isInt().withMessage('Неверный ID пользователя'),
  body('type').equals('email').withMessage('Поддерживается только верификация по email')
], async (req, res) => {
  try {
    const { userId } = req.body;

    const client = await pool.connect();
    try {
      // Получаем данные пользователя
      const userResult = await client.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const user = userResult.rows[0];
      const code = verificationService.generateVerificationCode();

      // Сохраняем новый код
      await verificationService.saveVerificationCode(userId, code, 'email', { pool });

      // Отправляем код
      await verificationService.sendEmailVerification(user.email, code);

      res.json({ message: 'Код отправлен повторно' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Resend code error:', err);
    res.status(500).json({ error: 'Ошибка отправки кода' });
  }
});

// Вход
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('rememberMe').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, rememberMe = false } = req.body;

    const client = await pool.connect();
    try {
      // Находим пользователя
      const userResult = await client.query(
        `SELECT id, email, password_hash, first_name, last_name, role, is_active, 
                email_verified, two_factor_enabled, two_factor_secret, password_changed_at
         FROM users WHERE email = $1`,
        [email]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Неверные учетные данные' });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Аккаунт заблокирован' });
      }

      if (!user.email_verified) {
        return res.status(401).json({ error: 'Email не подтвержден' });
      }


      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Неверные учетные данные' });
      }

      // Если включена 2FA, требуем код
      if (user.two_factor_enabled) {
        return res.json({
          requiresTwoFactor: true,
          userId: user.id,
          message: 'Введите код из приложения аутентификатора'
        });
      }

      // Если оператор не менял пароль (password_changed_at = NULL), требуем смену пароля
      if (user.role === 'operator' && !user.password_changed_at) {
        return res.json({
          requiresPasswordChange: true,
          userId: user.id,
          message: 'Необходимо сменить пароль при первом входе'
        });
      }

      // Обновляем время последнего входа
      await client.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Генерируем JWT токен
      const tokenExpiry = rememberMe ? '30d' : '14d';
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: tokenExpiry }
      );

      // Создаем сессию
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionExpiry = rememberMe ? 
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : // 30 дней
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);  // 14 дней

      await client.query(
        `INSERT INTO user_sessions (user_id, session_token, remember_me, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, sessionToken, rememberMe, sessionExpiry]
      );

      res.json({
        message: 'Вход выполнен успешно',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token,
        sessionToken
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

// Вход через телефон
router.post('/login-phone', [
  body('phone').isMobilePhone('ru-RU'),
  body('password').notEmpty(),
  body('rememberMe').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone, password, rememberMe = false } = req.body;

    const client = await pool.connect();
    try {
      // Находим пользователя по телефону
      const userResult = await client.query(
        `SELECT id, email, password_hash, first_name, last_name, role, is_active, 
                email_verified, two_factor_enabled, two_factor_secret
         FROM users WHERE phone = $1`,
        [phone]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Неверные учетные данные' });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Аккаунт заблокирован' });
      }

      if (!user.email_verified) {
        return res.status(401).json({ error: 'Email не подтвержден' });
      }


      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Неверные учетные данные' });
      }

      // Если включена 2FA, требуем код
      if (user.two_factor_enabled) {
        return res.json({
          requiresTwoFactor: true,
          userId: user.id,
          message: 'Введите код из приложения аутентификатора'
        });
      }

      // Обновляем время последнего входа
      await client.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Генерируем JWT токен
      const tokenExpiry = rememberMe ? '30d' : '14d';
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: tokenExpiry }
      );

      // Создаем сессию
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionExpiry = rememberMe ? 
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : // 30 дней
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);  // 14 дней

      await client.query(
        `INSERT INTO user_sessions (user_id, session_token, remember_me, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, sessionToken, rememberMe, sessionExpiry]
      );

      res.json({
        message: 'Вход выполнен успешно',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token,
        sessionToken
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Phone login error:', err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

// Подтверждение 2FA
router.post('/verify-2fa', [
  body('userId').isInt().withMessage('Неверный ID пользователя'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Код должен содержать 6 цифр')
], async (req, res) => {
  try {
    const { userId, code } = req.body;

    const client = await pool.connect();
    try {
      // Получаем секрет 2FA
      const userResult = await client.query(
        'SELECT two_factor_secret, email, role FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const user = userResult.rows[0];

      // Проверяем TOTP код
      const isValidCode = verificationService.verifyTOTP(user.two_factor_secret, code);
      if (!isValidCode) {
        return res.status(400).json({ error: 'Неверный код аутентификации' });
      }

      // Обновляем время последнего входа
      await client.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [userId]
      );

      // Генерируем JWT токен
      const token = jwt.sign(
        { userId, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '14d' }
      );

      res.json({
        message: '2FA подтвержден успешно',
        user: {
          id: userId,
          email: user.email,
          role: user.role
        },
        token
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('2FA verification error:', err);
    res.status(500).json({ error: 'Ошибка подтверждения 2FA' });
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
  body('phone').optional().custom((value) => {
    if (!value || value.trim() === '') return true; // Пустое значение разрешено
    return /^[\+]?[1-9][\d]{0,15}$/.test(value); // Проверяем формат только если значение не пустое
  }).withMessage('Неверный формат телефона'),
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

// Принудительная смена пароля для оператора (при первом входе)
router.put('/force-change-password', [
  body('userId').isInt().withMessage('Неверный ID пользователя'),
  body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен'),
  body('newPassword').custom(passwordValidation).withMessage('Пароль не соответствует требованиям')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, currentPassword, newPassword } = req.body;

    const client = await pool.connect();
    try {
      // Получаем пользователя
      const userResult = await client.query(
        'SELECT id, password_hash, role, password_changed_at FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const user = userResult.rows[0];

      // Проверяем, что это оператор и пароль не менялся
      if (user.role !== 'operator' || user.password_changed_at !== null) {
        return res.status(400).json({ error: 'Смена пароля не требуется' });
      }

      // Проверяем текущий пароль
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Неверный текущий пароль' });
      }

      // Хешируем новый пароль
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Обновляем пароль и устанавливаем время смены пароля
      await client.query(
        'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPasswordHash, userId]
      );

      res.json({ message: 'Пароль успешно изменен' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Force password change error:', err);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
});

module.exports = router;


