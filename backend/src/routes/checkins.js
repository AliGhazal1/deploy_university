const express = require('express');
const Joi = require('joi');
const QRCode = require('qrcode');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const checkinSchema = Joi.object({
  event_id: Joi.number().integer().required(),
  user_id: Joi.number().integer().required(),
  qr_code: Joi.string().required()
});

/**
 * @swagger
 * /checkins:
 *   post:
 *     summary: Validate QR check-in
 *     tags: [Check-ins]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event_id
 *               - user_id
 *               - qr_code
 *             properties:
 *               event_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *               qr_code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Check-in successful
 *       400:
 *         description: Invalid QR code or check-in not allowed
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { error, value } = checkinSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { event_id, user_id, qr_code } = value;

    // Verify user can only check in themselves unless they're faculty/admin
    if (user_id !== req.user.id && !['faculty', 'prof', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Can only check in yourself' });
    }

    // Verify event exists and is currently happening
    const eventResult = await db.query(
      'SELECT * FROM events WHERE id = $1',
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];
    const now = new Date();
    const eventStart = new Date(event.starts_at);
    const eventEnd = new Date(event.ends_at);

    // Allow check-in 15 minutes before event starts and until event ends
    const checkinStart = new Date(eventStart.getTime() - 15 * 60 * 1000);
    
    if (now < checkinStart || now > eventEnd) {
      return res.status(400).json({ error: 'Check-in not available for this event at this time' });
    }

    // Verify user is registered for the event
    const participantResult = await db.query(
      'SELECT * FROM event_participants WHERE event_id = $1 AND user_id = $2 AND status = $3',
      [event_id, user_id, 'confirmed']
    );

    if (participantResult.rows.length === 0) {
      return res.status(400).json({ error: 'User not registered for this event' });
    }

    // Validate QR code (simple validation - in production, use proper QR validation)
    const expectedQRData = `event:${event_id}:${event.starts_at}`;
    if (qr_code !== expectedQRData) {
      return res.status(400).json({ error: 'Invalid QR code' });
    }

    // Check if already checked in
    const existingCheckin = await db.query(
      'SELECT * FROM checkins WHERE event_id = $1 AND user_id = $2',
      [event_id, user_id]
    );

    if (existingCheckin.rows.length > 0) {
      return res.status(409).json({ error: 'Already checked in to this event' });
    }

    // Create check-in record
    await db.query(
      'INSERT INTO checkins (event_id, user_id, checked_in_at) VALUES ($1, $2, NOW())',
      [event_id, user_id]
    );

    // Update event participant status
    await db.query(
      'UPDATE event_participants SET status = $1 WHERE event_id = $2 AND user_id = $3',
      ['attended', event_id, user_id]
    );

    // Award points (with daily cap check)
    const today = new Date().toISOString().split('T')[0];
    const dailyCheckins = await db.query(
      `SELECT COUNT(*) as count FROM checkins 
       WHERE user_id = $1 AND DATE(checked_in_at) = $2`,
      [user_id, today]
    );

    const checkinCount = parseInt(dailyCheckins.rows[0].count);
    const maxDailyCheckins = 3;
    
    if (checkinCount <= maxDailyCheckins) {
      const points = Math.max(20 - (checkinCount - 1) * 5, 5); // 20, 15, 10 points for first 3 checkins
      
      await db.query(
        'INSERT INTO rewards (user_id, points, reason, created_at) VALUES ($1, $2, $3, NOW())',
        [user_id, points, `event_checkin:${event_id}`]
      );

      res.json({ 
        message: 'Check-in successful',
        points_awarded: points,
        daily_checkins: checkinCount
      });
    } else {
      res.json({ 
        message: 'Check-in successful (daily point limit reached)',
        points_awarded: 0,
        daily_checkins: checkinCount
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /checkins/generate-qr/{event_id}:
 *   get:
 *     summary: Generate QR code for event (host only)
 *     tags: [Check-ins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: event_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: QR code generated
 */
router.get('/generate-qr/:event_id', authenticateToken, async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.event_id);

    // Verify event exists and user is the host
    const eventResult = await db.query(
      'SELECT * FROM events WHERE id = $1',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    if (event.host_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only event host can generate QR code' });
    }

    // Generate QR code data
    const qrData = `event:${eventId}:${event.starts_at}`;
    
    try {
      const qrCodeUrl = await QRCode.toDataURL(qrData);
      
      res.json({
        qr_code: qrCodeUrl,
        qr_data: qrData,
        event: {
          id: event.id,
          title: event.title,
          starts_at: event.starts_at,
          ends_at: event.ends_at
        }
      });
    } catch (qrError) {
      return res.status(500).json({ error: 'Failed to generate QR code' });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /checkins/event/{event_id}:
 *   get:
 *     summary: Get check-in status for event (host only)
 *     tags: [Check-ins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: event_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Check-in statistics
 */
router.get('/event/:event_id', authenticateToken, async (req, res, next) => {
  try {
    const eventId = parseInt(req.params.event_id);

    // Verify event exists and user is the host
    const eventResult = await db.query(
      'SELECT * FROM events WHERE id = $1',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    if (event.host_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get check-in statistics
    const stats = await db.query(`
      SELECT 
        COUNT(ep.user_id) as total_registered,
        COUNT(c.user_id) as total_checked_in,
        ROUND(COUNT(c.user_id) * 100.0 / NULLIF(COUNT(ep.user_id), 0), 2) as attendance_rate
      FROM event_participants ep
      LEFT JOIN checkins c ON ep.event_id = c.event_id AND ep.user_id = c.user_id
      WHERE ep.event_id = $1 AND ep.status IN ('confirmed', 'attended')
    `, [eventId]);

    // Get detailed check-in list
    const checkins = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        c.checked_in_at,
        ep.registered_at
      FROM event_participants ep
      JOIN users u ON ep.user_id = u.id
      LEFT JOIN checkins c ON ep.event_id = c.event_id AND ep.user_id = c.user_id
      WHERE ep.event_id = $1 AND ep.status IN ('confirmed', 'attended')
      ORDER BY c.checked_in_at DESC, ep.registered_at
    `, [eventId]);

    const statistics = stats.rows[0];

    res.json({
      event: {
        id: event.id,
        title: event.title,
        starts_at: event.starts_at,
        ends_at: event.ends_at
      },
      statistics: {
        total_registered: parseInt(statistics.total_registered),
        total_checked_in: parseInt(statistics.total_checked_in),
        attendance_rate: parseFloat(statistics.attendance_rate) || 0
      },
      participants: checkins.rows.map(p => ({
        user_id: p.id,
        name: p.name,
        email: p.email,
        registered_at: p.registered_at,
        checked_in_at: p.checked_in_at,
        status: p.checked_in_at ? 'attended' : 'registered'
      }))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
