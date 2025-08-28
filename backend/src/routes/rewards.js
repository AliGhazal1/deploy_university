const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const redeemSchema = Joi.object({
  coupon_type: Joi.string().valid('coffee_discount', 'food_discount', 'study_space', 'other').required(),
  points_cost: Joi.number().integer().min(1).required(),
  partner_id: Joi.number().integer().optional()
});

/**
 * @swagger
 * /rewards/{user_id}:
 *   get:
 *     summary: Get user reward balance
 *     tags: [Rewards]
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
 *         description: User reward balance and history
 */
router.get('/:user_id', authenticateToken, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.user_id);

    // Users can only view their own rewards unless admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get current balance
    const balanceResult = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END), 0) as total_spent,
        COALESCE(SUM(points), 0) as current_balance
      FROM rewards 
      WHERE user_id = $1
    `, [userId]);

    const balance = balanceResult.rows[0];

    // Get recent transactions
    const transactionsResult = await db.query(`
      SELECT 
        id,
        points,
        reason,
        created_at,
        CASE 
          WHEN points > 0 THEN 'earned'
          ELSE 'spent'
        END as type
      FROM rewards 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [userId]);

    // Get available coupons/rewards
    const availableCoupons = [
      { type: 'coffee_discount', name: '20% Off Coffee', points_cost: 50, description: 'Valid at campus cafés' },
      { type: 'food_discount', name: '15% Off Food', points_cost: 75, description: 'Valid at dining halls' },
      { type: 'study_space', name: 'Premium Study Room', points_cost: 100, description: '2-hour booking' },
      { type: 'other', name: 'Campus Store Discount', points_cost: 150, description: '10% off merchandise' }
    ];

    res.json({
      user_id: userId,
      balance: {
        current: parseInt(balance.current_balance),
        total_earned: parseInt(balance.total_earned),
        total_spent: parseInt(balance.total_spent)
      },
      recent_transactions: transactionsResult.rows.map(t => ({
        id: t.id,
        type: t.type,
        points: Math.abs(t.points),
        reason: t.reason,
        created_at: t.created_at
      })),
      available_coupons: availableCoupons.filter(c => c.points_cost <= parseInt(balance.current_balance))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /rewards/{user_id}:
 *   post:
 *     summary: Redeem coupon
 *     tags: [Rewards]
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
 *             required:
 *               - coupon_type
 *               - points_cost
 *             properties:
 *               coupon_type:
 *                 type: string
 *                 enum: [coffee_discount, food_discount, study_space, other]
 *               points_cost:
 *                 type: integer
 *                 minimum: 1
 *               partner_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Coupon redeemed successfully
 *       400:
 *         description: Insufficient points
 */
router.post('/:user_id', authenticateToken, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.user_id);

    // Users can only redeem for themselves
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Can only redeem rewards for yourself' });
    }

    const { error, value } = redeemSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { coupon_type, points_cost, partner_id } = value;

    // Check current balance
    const balanceResult = await db.query(
      'SELECT COALESCE(SUM(points), 0) as balance FROM rewards WHERE user_id = $1',
      [userId]
    );

    const currentBalance = parseInt(balanceResult.rows[0].balance);

    if (currentBalance < points_cost) {
      return res.status(400).json({ 
        error: 'Insufficient points',
        current_balance: currentBalance,
        required: points_cost
      });
    }

    // Generate coupon code
    const couponCode = generateCouponCode(coupon_type);

    // Deduct points
    await db.query(
      'INSERT INTO rewards (user_id, points, reason, created_at) VALUES ($1, $2, $3, NOW())',
      [userId, -points_cost, `coupon_redemption:${coupon_type}:${couponCode}`]
    );

    // Create coupon record (you might want a separate coupons table)
    const couponResult = await db.query(`
      INSERT INTO user_coupons (user_id, coupon_code, coupon_type, points_cost, partner_id, status, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW() + INTERVAL '30 days')
      RETURNING *
    `, [userId, couponCode, coupon_type, points_cost, partner_id || null]);

    const coupon = couponResult.rows[0];

    res.json({
      message: 'Coupon redeemed successfully',
      coupon: {
        code: coupon.coupon_code,
        type: coupon.coupon_type,
        points_cost: coupon.points_cost,
        expires_at: coupon.expires_at,
        status: coupon.status
      },
      new_balance: currentBalance - points_cost
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /rewards/leaderboard:
 *   get:
 *     summary: Get points leaderboard
 *     tags: [Rewards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Top users by points
 */
router.get('/leaderboard', authenticateToken, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const leaderboard = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.role,
        COALESCE(SUM(r.points), 0) as total_points,
        COUNT(CASE WHEN r.points > 0 THEN 1 END) as activities_completed
      FROM users u
      LEFT JOIN rewards r ON u.id = r.user_id
      WHERE u.is_active = true
      GROUP BY u.id, u.name, u.role
      HAVING COALESCE(SUM(r.points), 0) > 0
      ORDER BY total_points DESC
      LIMIT $1
    `, [limit]);

    res.json({
      leaderboard: leaderboard.rows.map((user, index) => ({
        rank: index + 1,
        user_id: user.id,
        name: user.name,
        role: user.role,
        total_points: parseInt(user.total_points),
        activities_completed: parseInt(user.activities_completed)
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /rewards/coupons/{user_id}:
 *   get:
 *     summary: Get user's active coupons
 *     tags: [Rewards]
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
 *         description: User's active coupons
 */
router.get('/coupons/:user_id', authenticateToken, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.user_id);

    // Users can only view their own coupons unless admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const coupons = await db.query(`
      SELECT 
        uc.*,
        u.name as partner_name
      FROM user_coupons uc
      LEFT JOIN users u ON uc.partner_id = u.id
      WHERE uc.user_id = $1 
        AND uc.status = 'active' 
        AND uc.expires_at > NOW()
      ORDER BY uc.created_at DESC
    `, [userId]);

    res.json({
      coupons: coupons.rows.map(c => ({
        id: c.id,
        code: c.coupon_code,
        type: c.coupon_type,
        points_cost: c.points_cost,
        partner_name: c.partner_name,
        created_at: c.created_at,
        expires_at: c.expires_at,
        status: c.status
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to generate coupon codes
function generateCouponCode(type) {
  const prefix = type.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

module.exports = router;
