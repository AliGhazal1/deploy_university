const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const signupSchema = Joi.object({
  email: Joi.string().email().required().custom((value, helpers) => {
    if (!value.endsWith('.edu')) {
      return helpers.error('any.invalid');
    }
    return value;
  }, '.edu email validation'),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid('student', 'faculty', 'admin').required(),
  university: Joi.string().min(2).max(100).required(),
  degree: Joi.string().max(100).optional(),
  major: Joi.string().max(100).optional(),
  year_of_study: Joi.number().integer().min(1).max(10).optional(),
  interests: Joi.array().items(Joi.string().max(50)).optional(),
  bio: Joi.string().max(500).optional(),
  availability: Joi.object().optional(),
  free_time: Joi.object().optional(),
  social_links: Joi.object().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register new user (must have .edu email)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Must end with .edu
 *               password:
 *                 type: string
 *                 minLength: 6
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [student, faculty, prof, partner]
 *               degree:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { error, value } = signupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { 
      email, 
      password, 
      name, 
      role, 
      university,
      degree,
      major,
      year_of_study,
      interests,
      bio,
      availability,
      free_time,
      social_links
    } = value;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (email, password_hash, name, role, university, is_active, email_verified, created_at) 
       VALUES ($1, $2, $3, $4, $5, true, true, NOW()) 
       RETURNING id, email, name, role, university, created_at`,
      [email, hashedPassword, name, role, university]
    );

    const user = userResult.rows[0];

    // Create comprehensive profile
    await db.query(
      `INSERT INTO user_profiles (user_id, degree, major, year_of_study, interests, bio, availability, free_time, social_links, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        user.id,
        degree || null,
        major || null,
        year_of_study || null,
        interests || [],
        bio || null,
        JSON.stringify(availability || {}),
        JSON.stringify(free_time || {}),
        JSON.stringify(social_links || {})
      ]
    );

    // Create initial reward balance
    await db.query(
      `INSERT INTO rewards (user_id, points_balance, total_earned, total_redeemed, created_at) 
       VALUES ($1, 0, 0, 0, NOW())`,
      [user.id]
    );

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        university: user.university
      },
      token
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user and return JWT
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authentication successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    // Get user
    const userResult = await db.query(
      'SELECT id, email, password_hash, name, role, degree, is_active FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account deactivated' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
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
        name: user.name,
        role: user.role,
        university: user.university
      },
      token
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const userResult = await db.query(
      'SELECT id, email, name, role, degree, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({ user: userResult.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New token generated
 *       401:
 *         description: Unauthorized
 */
router.post('/refresh', authenticateToken, async (req, res, next) => {
  try {
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
