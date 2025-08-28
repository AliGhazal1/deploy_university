const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const reportSchema = Joi.object({
  reported_user_id: Joi.number().integer().required(),
  reason: Joi.string().valid(
    'harassment', 'inappropriate_content', 'spam', 'fake_profile', 
    'safety_concern', 'academic_dishonesty', 'other'
  ).required(),
  description: Joi.string().max(1000).required(),
  evidence_url: Joi.string().uri().optional()
});

/**
 * @swagger
 * /reports:
 *   post:
 *     summary: Create user report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reported_user_id
 *               - reason
 *               - description
 *             properties:
 *               reported_user_id:
 *                 type: integer
 *               reason:
 *                 type: string
 *                 enum: [harassment, inappropriate_content, spam, fake_profile, safety_concern, academic_dishonesty, other]
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               evidence_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Report created successfully
 *       400:
 *         description: Cannot report yourself or duplicate report
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { error, value } = reportSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { reported_user_id, reason, description, evidence_url } = value;
    const reporterId = req.user.id;

    // Cannot report yourself
    if (reporterId === reported_user_id) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    // Check if reported user exists
    const userCheck = await db.query(
      'SELECT id, is_active FROM users WHERE id = $1',
      [reported_user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Reported user not found' });
    }

    // Check for duplicate reports (same reporter, same user, within 24 hours)
    const duplicateCheck = await db.query(`
      SELECT id FROM reports 
      WHERE reporter_id = $1 
        AND reported_user_id = $2 
        AND created_at > NOW() - INTERVAL '24 hours'
        AND status != 'dismissed'
    `, [reporterId, reported_user_id]);

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ error: 'You have already reported this user recently' });
    }

    // Create report
    const result = await db.query(`
      INSERT INTO reports (reporter_id, reported_user_id, reason, description, evidence_url, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
      RETURNING *
    `, [reporterId, reported_user_id, reason, description, evidence_url || null]);

    const report = result.rows[0];

    // Auto-apply temporary restrictions for serious reports
    if (['harassment', 'safety_concern'].includes(reason)) {
      await db.query(`
        INSERT INTO user_restrictions (user_id, restriction_type, reason, expires_at, created_at)
        VALUES ($1, 'messaging_limited', 'pending_report_review', NOW() + INTERVAL '24 hours', NOW())
      `, [reported_user_id]);
    }

    res.status(201).json({
      message: 'Report submitted successfully',
      report: {
        id: report.id,
        reported_user_id: report.reported_user_id,
        reason: report.reason,
        status: report.status,
        created_at: report.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /reports:
 *   get:
 *     summary: Admin fetch open reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, under_review, resolved, dismissed]
 *           default: pending
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
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
 *         description: List of reports
 */
router.get('/', authenticateToken, requireRole(['admin', 'faculty']), async (req, res, next) => {
  try {
    const { status = 'pending', reason, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        r.*,
        reporter.name as reporter_name,
        reporter.email as reporter_email,
        reported.name as reported_user_name,
        reported.email as reported_user_email,
        COUNT(*) OVER() as total_count
      FROM reports r
      JOIN users reporter ON r.reporter_id = reporter.id
      JOIN users reported ON r.reported_user_id = reported.id
      WHERE r.status = $1
    `;
    const params = [status];

    if (reason) {
      query += ` AND r.reason = $${params.length + 1}`;
      params.push(reason);
    }

    query += ` 
      ORDER BY r.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    const totalCount = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const reports = result.rows.map(row => ({
      id: row.id,
      reporter: {
        id: row.reporter_id,
        name: row.reporter_name,
        email: row.reporter_email
      },
      reported_user: {
        id: row.reported_user_id,
        name: row.reported_user_name,
        email: row.reported_user_email
      },
      reason: row.reason,
      description: row.description,
      evidence_url: row.evidence_url,
      status: row.status,
      action_taken: row.action_taken,
      admin_notes: row.admin_notes,
      created_at: row.created_at,
      resolved_at: row.resolved_at
    }));

    res.json({
      reports,
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
 * /reports/{id}/resolve:
 *   put:
 *     summary: Resolve report (admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action_taken
 *             properties:
 *               action_taken:
 *                 type: string
 *                 enum: [no_action, warning_issued, messaging_blocked, account_suspended, account_banned]
 *               admin_notes:
 *                 type: string
 *                 maxLength: 500
 *               restriction_duration:
 *                 type: integer
 *                 description: Duration in hours for temporary restrictions
 *     responses:
 *       200:
 *         description: Report resolved successfully
 */
router.put('/:id/resolve', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id);
    const { action_taken, admin_notes, restriction_duration } = req.body;

    const validActions = ['no_action', 'warning_issued', 'messaging_blocked', 'account_suspended', 'account_banned'];
    if (!validActions.includes(action_taken)) {
      return res.status(400).json({ error: 'Invalid action_taken value' });
    }

    // Get report details
    const reportResult = await db.query(
      'SELECT * FROM reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    // Update report status
    await db.query(`
      UPDATE reports 
      SET status = 'resolved', action_taken = $1, admin_notes = $2, resolved_at = NOW(), resolved_by = $3
      WHERE id = $4
    `, [action_taken, admin_notes || null, req.user.id, reportId]);

    // Apply actions based on resolution
    switch (action_taken) {
      case 'warning_issued':
        // Send system message to user
        await db.query(`
          INSERT INTO messages (sender_id, receiver_id, body, message_type, created_at)
          VALUES (1, $1, $2, 'system', NOW())
        `, [
          report.reported_user_id,
          `You have received a warning for: ${report.reason}. Please review our community guidelines.`
        ]);
        break;

      case 'messaging_blocked':
        const messagingDuration = restriction_duration || 168; // Default 7 days
        await db.query(`
          INSERT INTO user_restrictions (user_id, restriction_type, reason, expires_at, created_at)
          VALUES ($1, 'messaging_blocked', $2, NOW() + INTERVAL '${messagingDuration} hours', NOW())
        `, [report.reported_user_id, `Report resolution: ${report.reason}`]);
        break;

      case 'account_suspended':
        const suspensionDuration = restriction_duration || 720; // Default 30 days
        await db.query(`
          INSERT INTO user_restrictions (user_id, restriction_type, reason, expires_at, created_at)
          VALUES ($1, 'account_suspended', $2, NOW() + INTERVAL '${suspensionDuration} hours', NOW())
        `, [report.reported_user_id, `Report resolution: ${report.reason}`]);
        
        // Deactivate user temporarily
        await db.query(
          'UPDATE users SET is_active = false WHERE id = $1',
          [report.reported_user_id]
        );
        break;

      case 'account_banned':
        // Permanent ban
        await db.query(`
          INSERT INTO user_restrictions (user_id, restriction_type, reason, expires_at, created_at)
          VALUES ($1, 'account_banned', $2, NULL, NOW())
        `, [report.reported_user_id, `Report resolution: ${report.reason}`]);
        
        await db.query(
          'UPDATE users SET is_active = false WHERE id = $1',
          [report.reported_user_id]
        );
        break;
    }

    res.json({
      message: 'Report resolved successfully',
      action_taken,
      report_id: reportId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /reports/my-reports:
 *   get:
 *     summary: Get current user's submitted reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's submitted reports
 */
router.get('/my-reports', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const reports = await db.query(`
      SELECT 
        r.id,
        r.reason,
        r.description,
        r.status,
        r.action_taken,
        r.created_at,
        r.resolved_at,
        reported.name as reported_user_name
      FROM reports r
      JOIN users reported ON r.reported_user_id = reported.id
      WHERE r.reporter_id = $1
      ORDER BY r.created_at DESC
    `, [userId]);

    res.json({
      reports: reports.rows.map(r => ({
        id: r.id,
        reported_user_name: r.reported_user_name,
        reason: r.reason,
        description: r.description,
        status: r.status,
        action_taken: r.action_taken,
        created_at: r.created_at,
        resolved_at: r.resolved_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /reports/statistics:
 *   get:
 *     summary: Get reporting statistics (admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Report statistics
 */
router.get('/statistics', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_reports,
        COUNT(CASE WHEN reason = 'harassment' THEN 1 END) as harassment_reports,
        COUNT(CASE WHEN reason = 'safety_concern' THEN 1 END) as safety_reports,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as reports_last_week
      FROM reports
    `);

    const topReasons = await db.query(`
      SELECT reason, COUNT(*) as count
      FROM reports
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY reason
      ORDER BY count DESC
      LIMIT 5
    `);

    res.json({
      statistics: stats.rows[0],
      top_reasons_last_30_days: topReasons.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
