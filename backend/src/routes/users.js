const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User profile
 *       404:
 *         description: User not found
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Users can only view their own profile or admins can view any
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userResult = await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.degree, u.created_at, u.is_active,
              p.interests, p.availability, p.free_time, p.updated_at as profile_updated
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        degree: user.degree,
        created_at: user.created_at,
        is_active: user.is_active,
        profile: {
          interests: user.interests || [],
          availability: user.availability || {},
          free_time: user.free_time || {},
          updated_at: user.profile_updated
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [student, faculty, prof, partner]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const role = req.query.role;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    let query = `
      SELECT u.id, u.email, u.name, u.role, u.degree, u.created_at, u.is_active,
             COUNT(*) OVER() as total_count
      FROM users u
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      query += ` AND u.role = $${params.length + 1}`;
      params.push(role);
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    const totalCount = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      degree: row.degree,
      created_at: row.created_at,
      is_active: row.is_active
    }));

    res.json({
      users,
      pagination: {
        page,
        limit,
        total: parseInt(totalCount),
        pages: Math.ceil(parseInt(totalCount) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /users/{id}/deactivate:
 *   put:
 *     summary: Deactivate user account (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deactivated
 */
router.put('/:id/deactivate', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    await db.query(
      'UPDATE users SET is_active = false WHERE id = $1',
      [userId]
    );

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
