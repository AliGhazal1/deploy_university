const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const eventSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).required(),
  event_type: Joi.string().valid('clinic', 'power-hour', 'study-group', 'social', 'workshop', 'other').required(),
  location: Joi.string().max(200).required(),
  starts_at: Joi.date().greater('now').required(),
  ends_at: Joi.date().greater(Joi.ref('starts_at')).required(),
  capacity: Joi.number().integer().min(1).max(500).required(),
  is_public: Joi.boolean().default(true)
});

const rsvpSchema = Joi.object({
  user_id: Joi.number().integer().required()
});

/**
 * @swagger
 * /events:
 *   get:
 *     summary: List events
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [clinic, power-hour, study-group, social, workshop, other]
 *       - in: query
 *         name: upcoming
 *         schema:
 *           type: boolean
 *           default: true
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
 *         description: List of events
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { type, upcoming = 'true', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        e.*,
        u.name as host_name,
        u.role as host_role,
        COUNT(ep.user_id) as current_participants,
        COUNT(*) OVER() as total_count
      FROM events e
      JOIN users u ON e.host_id = u.id
      LEFT JOIN event_participants ep ON e.id = ep.event_id AND ep.status = 'confirmed'
      WHERE e.is_public = true
    `;
    const params = [];

    if (type) {
      query += ` AND e.event_type = $${params.length + 1}`;
      params.push(type);
    }

    if (upcoming === 'true') {
      query += ` AND e.starts_at > NOW()`;
    }

    query += ` 
      GROUP BY e.id, u.name, u.role
      ORDER BY e.starts_at ASC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    const totalCount = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const events = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      event_type: row.event_type,
      location: row.location,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      capacity: row.capacity,
      current_participants: parseInt(row.current_participants),
      host: {
        id: row.host_id,
        name: row.host_name,
        role: row.host_role
      },
      created_at: row.created_at
    }));

    res.json({
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalCount),
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create event (faculty/partner only)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - event_type
 *               - location
 *               - starts_at
 *               - ends_at
 *               - capacity
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               event_type:
 *                 type: string
 *                 enum: [clinic, power-hour, study-group, social, workshop, other]
 *               location:
 *                 type: string
 *                 maxLength: 200
 *               starts_at:
 *                 type: string
 *                 format: date-time
 *               ends_at:
 *                 type: string
 *                 format: date-time
 *               capacity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 500
 *               is_public:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Event created successfully
 */
router.post('/', authenticateToken, requireRole(['faculty', 'prof', 'partner']), async (req, res, next) => {
  try {
    const { error, value } = eventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { title, description, event_type, location, starts_at, ends_at, capacity, is_public } = value;

    const result = await db.query(
      `INSERT INTO events (host_id, title, description, event_type, location, starts_at, ends_at, capacity, is_public, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [req.user.id, title, description, event_type, location, starts_at, ends_at, capacity, is_public]
    );

    const event = result.rows[0];

    res.status(201).json({
      message: 'Event created successfully',
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        event_type: event.event_type,
        location: event.location,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        capacity: event.capacity,
        is_public: event.is_public,
        host_id: event.host_id,
        created_at: event.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /events/{id}/rsvp:
 *   post:
 *     summary: RSVP to event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: RSVP saved successfully
 *       409:
 *         description: Already registered or event full
 */
router.post('/:id/rsvp', authenticateToken, async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.id);
    const userId = req.body.user_id || req.user.id;

    // Users can only RSVP for themselves unless they're admin
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Can only RSVP for yourself' });
    }

    // Check if event exists and get capacity
    const eventResult = await db.query(
      'SELECT id, capacity, starts_at FROM events WHERE id = $1',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Check if event hasn't started
    if (new Date(event.starts_at) <= new Date()) {
      return res.status(400).json({ error: 'Cannot RSVP to past or ongoing events' });
    }

    // Check if already registered
    const existingRsvp = await db.query(
      'SELECT id FROM event_participants WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (existingRsvp.rows.length > 0) {
      return res.status(409).json({ error: 'Already registered for this event' });
    }

    // Check capacity
    const participantCount = await db.query(
      'SELECT COUNT(*) as count FROM event_participants WHERE event_id = $1 AND status = $2',
      [eventId, 'confirmed']
    );

    if (parseInt(participantCount.rows[0].count) >= event.capacity) {
      return res.status(409).json({ error: 'Event is full' });
    }

    // Create RSVP
    await db.query(
      `INSERT INTO event_participants (event_id, user_id, status, registered_at)
       VALUES ($1, $2, 'confirmed', NOW())`,
      [eventId, userId]
    );

    res.json({ message: 'RSVP saved successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get event details
 *     tags: [Events]
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
 *         description: Event details
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.id);

    const result = await db.query(`
      SELECT 
        e.*,
        u.name as host_name,
        u.role as host_role,
        COUNT(ep.user_id) as current_participants
      FROM events e
      JOIN users u ON e.host_id = u.id
      LEFT JOIN event_participants ep ON e.id = ep.event_id AND ep.status = 'confirmed'
      WHERE e.id = $1
      GROUP BY e.id, u.name, u.role
    `, [eventId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = result.rows[0];

    // Get participants list (only for host or admin)
    let participants = [];
    if (req.user.id === event.host_id || req.user.role === 'admin') {
      const participantsResult = await db.query(`
        SELECT u.id, u.name, u.email, ep.registered_at
        FROM event_participants ep
        JOIN users u ON ep.user_id = u.id
        WHERE ep.event_id = $1 AND ep.status = 'confirmed'
        ORDER BY ep.registered_at
      `, [eventId]);
      
      participants = participantsResult.rows;
    }

    res.json({
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        event_type: event.event_type,
        location: event.location,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        capacity: event.capacity,
        current_participants: parseInt(event.current_participants),
        is_public: event.is_public,
        host: {
          id: event.host_id,
          name: event.host_name,
          role: event.host_role
        },
        created_at: event.created_at,
        participants: participants
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
