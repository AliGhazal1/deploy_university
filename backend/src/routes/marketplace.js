const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const marketplaceSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).required(),
  category: Joi.string().valid('textbook', 'job', 'errand', 'tutoring', 'other').required(),
  price: Joi.number().min(0).max(10000).required(),
  contact_info: Joi.string().max(200).optional(),
  expires_at: Joi.date().greater('now').optional()
});

/**
 * @swagger
 * /marketplace:
 *   get:
 *     summary: List marketplace posts
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [textbook, job, errand, tutoring, other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, completed, cancelled]
 *           default: open
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
 *         description: List of marketplace items
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { category, status = 'open', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        m.*,
        u.name as creator_name,
        u.role as creator_role,
        COUNT(*) OVER() as total_count
      FROM marketplace m
      JOIN users u ON m.creator_id = u.id
      WHERE m.status = $1
    `;
    const params = [status];

    if (category) {
      query += ` AND m.category = $${params.length + 1}`;
      params.push(category);
    }

    // Only show non-expired items
    query += ` AND (m.expires_at IS NULL OR m.expires_at > NOW())`;

    query += ` 
      ORDER BY m.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    const totalCount = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const items = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      price: parseFloat(row.price),
      status: row.status,
      creator: {
        id: row.creator_id,
        name: row.creator_name,
        role: row.creator_role
      },
      contact_info: row.contact_info,
      expires_at: row.expires_at,
      created_at: row.created_at
    }));

    res.json({
      items,
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
 * /marketplace:
 *   post:
 *     summary: Create new marketplace listing
 *     tags: [Marketplace]
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
 *               - category
 *               - price
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               category:
 *                 type: string
 *                 enum: [textbook, job, errand, tutoring, other]
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 10000
 *               contact_info:
 *                 type: string
 *                 maxLength: 200
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Marketplace item created
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { error, value } = marketplaceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { title, description, category, price, contact_info, expires_at } = value;

    const result = await db.query(
      `INSERT INTO marketplace (creator_id, title, description, category, price, contact_info, expires_at, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', NOW())
       RETURNING *`,
      [req.user.id, title, description, category, price, contact_info || null, expires_at || null]
    );

    const item = result.rows[0];

    res.status(201).json({
      message: 'Marketplace item created successfully',
      item: {
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        price: parseFloat(item.price),
        status: item.status,
        creator_id: item.creator_id,
        contact_info: item.contact_info,
        expires_at: item.expires_at,
        created_at: item.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /marketplace/{id}:
 *   put:
 *     summary: Update marketplace item status
 *     tags: [Marketplace]
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
 *               status:
 *                 type: string
 *                 enum: [open, completed, cancelled]
 *               buyer_id:
 *                 type: integer
 *                 description: Required when marking as completed
 *     responses:
 *       200:
 *         description: Item updated successfully
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const itemId = parseInt(req.params.id);
    const { status, buyer_id } = req.body;

    if (!['open', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get item to verify ownership
    const itemResult = await db.query(
      'SELECT * FROM marketplace WHERE id = $1',
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemResult.rows[0];

    // Only creator can update their items
    if (item.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If marking as completed, calculate and apply marketplace fee
    if (status === 'completed') {
      if (!buyer_id) {
        return res.status(400).json({ error: 'buyer_id required when marking as completed' });
      }

      // Calculate marketplace fee (5-10% based on price)
      const feePercentage = item.price > 100 ? 0.05 : 0.10; // 5% for items >$100, 10% for others
      const fee = item.price * feePercentage;
      const sellerAmount = item.price - fee;

      // Update item with completion details
      await db.query(
        `UPDATE marketplace 
         SET status = $1, buyer_id = $2, completed_at = NOW(), 
             marketplace_fee = $3, seller_amount = $4
         WHERE id = $5`,
        [status, buyer_id, fee, sellerAmount, itemId]
      );

      // Award points to both parties (simplified reward system)
      await db.query(
        `INSERT INTO rewards (user_id, points, reason, created_at)
         VALUES 
         ($1, 10, 'marketplace_sale', NOW()),
         ($2, 5, 'marketplace_purchase', NOW())`,
        [item.creator_id, buyer_id]
      );

      res.json({ 
        message: 'Item marked as completed',
        fee_applied: fee,
        seller_receives: sellerAmount
      });
    } else {
      // Simple status update
      await db.query(
        'UPDATE marketplace SET status = $1 WHERE id = $2',
        [status, itemId]
      );

      res.json({ message: 'Item status updated successfully' });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /marketplace/{id}:
 *   get:
 *     summary: Get marketplace item details
 *     tags: [Marketplace]
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
 *         description: Item details
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const itemId = parseInt(req.params.id);

    const result = await db.query(`
      SELECT 
        m.*,
        u.name as creator_name,
        u.role as creator_role,
        buyer.name as buyer_name
      FROM marketplace m
      JOIN users u ON m.creator_id = u.id
      LEFT JOIN users buyer ON m.buyer_id = buyer.id
      WHERE m.id = $1
    `, [itemId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = result.rows[0];

    res.json({
      item: {
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        price: parseFloat(item.price),
        status: item.status,
        creator: {
          id: item.creator_id,
          name: item.creator_name,
          role: item.creator_role
        },
        buyer: item.buyer_name ? {
          id: item.buyer_id,
          name: item.buyer_name
        } : null,
        contact_info: item.contact_info,
        marketplace_fee: item.marketplace_fee ? parseFloat(item.marketplace_fee) : null,
        seller_amount: item.seller_amount ? parseFloat(item.seller_amount) : null,
        expires_at: item.expires_at,
        created_at: item.created_at,
        completed_at: item.completed_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /marketplace/my-items:
 *   get:
 *     summary: Get current user's marketplace items
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's marketplace items
 */
router.get('/my-items', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        m.*,
        buyer.name as buyer_name
      FROM marketplace m
      LEFT JOIN users buyer ON m.buyer_id = buyer.id
      WHERE m.creator_id = $1
      ORDER BY m.created_at DESC
    `, [req.user.id]);

    const items = result.rows.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      price: parseFloat(item.price),
      status: item.status,
      buyer_name: item.buyer_name,
      marketplace_fee: item.marketplace_fee ? parseFloat(item.marketplace_fee) : null,
      seller_amount: item.seller_amount ? parseFloat(item.seller_amount) : null,
      created_at: item.created_at,
      completed_at: item.completed_at
    }));

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
