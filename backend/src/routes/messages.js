const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const messageSchema = Joi.object({
  receiver_id: Joi.number().integer().required(),
  body: Joi.string().min(1).max(1000).required(),
  message_type: Joi.string().valid('text', 'system').default('text')
});

/**
 * @swagger
 * /messages:
 *   get:
 *     summary: Get inbox for user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: conversation_with
 *         schema:
 *           type: integer
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
 *         description: User messages
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { user_id, conversation_with, page = 1, limit = 20 } = req.query;
    const userId = parseInt(user_id);
    const offset = (page - 1) * limit;

    // Users can only view their own messages
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if user is blocked from messaging
    const blockCheck = await db.query(`
      SELECT COUNT(*) as blocked_count 
      FROM reports r 
      WHERE r.reported_user_id = $1 
        AND r.status = 'resolved' 
        AND r.action_taken ILIKE '%messaging_blocked%'
    `, [userId]);

    if (parseInt(blockCheck.rows[0].blocked_count) > 0) {
      return res.status(403).json({ error: 'Messaging privileges suspended' });
    }

    let query, params;

    if (conversation_with) {
      // Get conversation between two users
      const conversationUserId = parseInt(conversation_with);
      query = `
        SELECT 
          m.*,
          sender.name as sender_name,
          receiver.name as receiver_name
        FROM messages m
        JOIN users sender ON m.sender_id = sender.id
        JOIN users receiver ON m.receiver_id = receiver.id
        WHERE (m.sender_id = $1 AND m.receiver_id = $2) 
           OR (m.sender_id = $2 AND m.receiver_id = $1)
        ORDER BY m.created_at DESC
        LIMIT $3 OFFSET $4
      `;
      params = [userId, conversationUserId, limit, offset];
    } else {
      // Get all messages for user (inbox/outbox)
      query = `
        SELECT 
          m.*,
          sender.name as sender_name,
          receiver.name as receiver_name,
          COUNT(*) OVER() as total_count
        FROM messages m
        JOIN users sender ON m.sender_id = sender.id
        JOIN users receiver ON m.receiver_id = receiver.id
        WHERE m.sender_id = $1 OR m.receiver_id = $1
        ORDER BY m.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [userId, limit, offset];
    }

    const result = await db.query(query, params);

    // Mark messages as read when viewing conversation
    if (conversation_with) {
      await db.query(
        'UPDATE messages SET read_at = NOW() WHERE receiver_id = $1 AND sender_id = $2 AND read_at IS NULL',
        [userId, parseInt(conversation_with)]
      );
    }

    const totalCount = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const messages = result.rows.map(row => ({
      id: row.id,
      sender: {
        id: row.sender_id,
        name: row.sender_name
      },
      receiver: {
        id: row.receiver_id,
        name: row.receiver_name
      },
      body: row.body,
      message_type: row.message_type,
      read_at: row.read_at,
      created_at: row.created_at,
      is_sent: row.sender_id === userId
    }));

    res.json({
      messages,
      pagination: conversation_with ? null : {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalCount || 0),
        pages: Math.ceil((totalCount || 0) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /messages:
 *   post:
 *     summary: Send message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiver_id
 *               - body
 *             properties:
 *               receiver_id:
 *                 type: integer
 *               body:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *               message_type:
 *                 type: string
 *                 enum: [text, system]
 *                 default: text
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       403:
 *         description: Messaging blocked or user blocked
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { error, value } = messageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { receiver_id, body, message_type } = value;
    const senderId = req.user.id;

    // Check if sender is blocked from messaging
    const senderBlockCheck = await db.query(`
      SELECT COUNT(*) as blocked_count 
      FROM reports r 
      WHERE r.reported_user_id = $1 
        AND r.status = 'resolved' 
        AND r.action_taken ILIKE '%messaging_blocked%'
    `, [senderId]);

    if (parseInt(senderBlockCheck.rows[0].blocked_count) > 0) {
      return res.status(403).json({ error: 'Messaging privileges suspended' });
    }

    // Check if receiver exists and is active
    const receiverResult = await db.query(
      'SELECT id, is_active FROM users WHERE id = $1',
      [receiver_id]
    );

    if (receiverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    if (!receiverResult.rows[0].is_active) {
      return res.status(400).json({ error: 'Cannot send message to inactive user' });
    }

    // Check if receiver has blocked sender
    const blockCheck = await db.query(`
      SELECT COUNT(*) as blocked_count 
      FROM reports r 
      WHERE r.reporter_id = $1 
        AND r.reported_user_id = $2 
        AND r.status = 'resolved' 
        AND r.action_taken ILIKE '%blocked%'
    `, [receiver_id, senderId]);

    if (parseInt(blockCheck.rows[0].blocked_count) > 0) {
      return res.status(403).json({ error: 'You have been blocked by this user' });
    }

    // Rate limiting: max 50 messages per hour per user
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentMessages = await db.query(
      'SELECT COUNT(*) as count FROM messages WHERE sender_id = $1 AND created_at > $2',
      [senderId, hourAgo]
    );

    if (parseInt(recentMessages.rows[0].count) >= 50) {
      return res.status(429).json({ error: 'Message rate limit exceeded. Please try again later.' });
    }

    // Send message
    const result = await db.query(
      `INSERT INTO messages (sender_id, receiver_id, body, message_type, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [senderId, receiver_id, body, message_type]
    );

    const message = result.rows[0];

    res.status(201).json({
      message: 'Message sent successfully',
      message_data: {
        id: message.id,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        body: message.body,
        message_type: message.message_type,
        created_at: message.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /messages/conversations:
 *   get:
 *     summary: Get user's conversation list
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 */
router.get('/conversations', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const conversations = await db.query(`
      WITH latest_messages AS (
        SELECT 
          CASE 
            WHEN sender_id = $1 THEN receiver_id 
            ELSE sender_id 
          END as other_user_id,
          MAX(created_at) as last_message_at,
          COUNT(CASE WHEN receiver_id = $1 AND read_at IS NULL THEN 1 END) as unread_count
        FROM messages 
        WHERE sender_id = $1 OR receiver_id = $1
        GROUP BY other_user_id
      )
      SELECT 
        lm.other_user_id,
        u.name as other_user_name,
        u.role as other_user_role,
        lm.last_message_at,
        lm.unread_count,
        m.body as last_message_body,
        m.sender_id as last_message_sender_id
      FROM latest_messages lm
      JOIN users u ON lm.other_user_id = u.id
      JOIN messages m ON (
        (m.sender_id = $1 AND m.receiver_id = lm.other_user_id) OR 
        (m.sender_id = lm.other_user_id AND m.receiver_id = $1)
      ) AND m.created_at = lm.last_message_at
      WHERE u.is_active = true
      ORDER BY lm.last_message_at DESC
    `, [userId]);

    res.json({
      conversations: conversations.rows.map(conv => ({
        other_user: {
          id: conv.other_user_id,
          name: conv.other_user_name,
          role: conv.other_user_role
        },
        last_message: {
          body: conv.last_message_body,
          sender_id: conv.last_message_sender_id,
          created_at: conv.last_message_at
        },
        unread_count: parseInt(conv.unread_count),
        last_activity: conv.last_message_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /messages/{id}/read:
 *   put:
 *     summary: Mark message as read
 *     tags: [Messages]
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
 *         description: Message marked as read
 */
router.put('/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id);
    const userId = req.user.id;

    const result = await db.query(
      'UPDATE messages SET read_at = NOW() WHERE id = $1 AND receiver_id = $2 AND read_at IS NULL RETURNING *',
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or already read' });
    }

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
