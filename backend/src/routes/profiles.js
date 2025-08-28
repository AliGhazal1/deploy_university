const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const profileUpdateSchema = Joi.object({
  survey_data: Joi.object().optional(),
  availability: Joi.array().items(Joi.object({
    day: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').required(),
    start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    end_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
  })).optional(),
  free_time: Joi.array().items(Joi.object({
    date: Joi.date().required(),
    start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    end_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    activity: Joi.string().max(100).optional()
  })).optional()
});

/**
 * @swagger
 * /profiles/{user_id}:
 *   put:
 *     summary: Update profile survey data & availability
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               survey_data:
 *                 type: object
 *                 description: Survey responses and preferences
 *               availability:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     day:
 *                       type: string
 *                       enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *                     start_time:
 *                       type: string
 *                       pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                     end_time:
 *                       type: string
 *                       pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *               free_time:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                     start_time:
 *                       type: string
 *                     end_time:
 *                       type: string
 *                     activity:
 *                       type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       403:
 *         description: Access denied
 */
router.put('/:user_id', authenticateToken, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.user_id);
    
    // Users can only update their own profile
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { error, value } = profileUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { survey_data, availability, free_time } = value;

    // Build update query dynamically
    const updates = [];
    const params = [userId];
    let paramCount = 1;

    if (survey_data !== undefined) {
      paramCount++;
      updates.push(`survey_data = $${paramCount}`);
      params.push(JSON.stringify(survey_data));
    }

    if (availability !== undefined) {
      paramCount++;
      updates.push(`availability = $${paramCount}`);
      params.push(JSON.stringify(availability));
    }

    if (free_time !== undefined) {
      paramCount++;
      updates.push(`free_time = $${paramCount}`);
      params.push(JSON.stringify(free_time));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = NOW()');

    const query = `
      UPDATE profiles 
      SET ${updates.join(', ')} 
      WHERE user_id = $1 
      RETURNING *
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
      profile: {
        user_id: profile.user_id,
        survey_data: profile.survey_data,
        availability: profile.availability,
        free_time: profile.free_time,
        updated_at: profile.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /profiles/{user_id}:
 *   get:
 *     summary: Get user profile
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User profile data
 *       404:
 *         description: Profile not found
 */
router.get('/:user_id', authenticateToken, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.user_id);

    const result = await db.query(
      `SELECT p.*, u.name, u.email, u.role, u.degree
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];

    res.json({
      profile: {
        user_id: profile.user_id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        degree: profile.degree,
        survey_data: profile.survey_data,
        availability: profile.availability,
        free_time: profile.free_time,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
