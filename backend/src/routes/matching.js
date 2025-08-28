const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const matchingSchema = Joi.object({
  user_id: Joi.number().integer().required(),
  desired_time: Joi.date().optional(),
  activity_type: Joi.string().max(50).optional(),
  max_results: Joi.number().integer().min(1).max(50).default(10)
});

/**
 * @swagger
 * /matching:
 *   post:
 *     summary: Get prioritized matches for student
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: integer
 *               desired_time:
 *                 type: string
 *                 format: date-time
 *               activity_type:
 *                 type: string
 *               max_results:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *                 default: 10
 *     responses:
 *       200:
 *         description: List of matched users with compatibility scores
 */
router.post('/', authenticateToken, requireRole(['student']), async (req, res, next) => {
  try {
    const { error, value } = matchingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { user_id, desired_time, activity_type, max_results } = value;

    // Verify user can only request matches for themselves
    if (req.user.id !== user_id) {
      return res.status(403).json({ error: 'Can only request matches for yourself' });
    }

    // Get user's profile and preferences
    const userProfile = await db.query(
      `SELECT p.*, u.degree, u.role 
       FROM profiles p 
       JOIN users u ON p.user_id = u.id 
       WHERE p.user_id = $1`,
      [user_id]
    );

    if (userProfile.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const currentUser = userProfile.rows[0];

    // Complex matching query with scoring
    const matchQuery = `
      WITH user_availability AS (
        SELECT 
          p.user_id,
          u.name,
          u.degree,
          u.role,
          p.survey_data,
          p.availability,
          p.free_time,
          -- Degree compatibility score (same degree = 3, related = 2, different = 1)
          CASE 
            WHEN u.degree = $2 THEN 3
            WHEN u.degree ILIKE '%' || SPLIT_PART($2, ' ', -1) || '%' THEN 2
            ELSE 1
          END as degree_score,
          -- Role compatibility (students with students = 3, mixed = 2)
          CASE 
            WHEN u.role = $3 THEN 3
            ELSE 2
          END as role_score,
          -- Survey compatibility (calculate based on common interests)
          CASE 
            WHEN p.survey_data::text ILIKE '%study%' AND $4::text ILIKE '%study%' THEN 2
            WHEN p.survey_data::text ILIKE '%social%' AND $4::text ILIKE '%social%' THEN 2
            ELSE 1
          END as interest_score
        FROM profiles p
        JOIN users u ON p.user_id = u.id
        WHERE u.id != $1 
          AND u.is_active = true
          AND p.availability IS NOT NULL
          AND jsonb_array_length(p.availability) > 0
      ),
      availability_matches AS (
        SELECT 
          ua.*,
          -- Time availability score (simplified - check if they have overlapping availability)
          CASE 
            WHEN $5::timestamp IS NOT NULL THEN
              CASE 
                WHEN ua.free_time::text ILIKE '%' || TO_CHAR($5::timestamp, 'YYYY-MM-DD') || '%' THEN 3
                ELSE 1
              END
            ELSE 2
          END as time_score
        FROM user_availability ua
      )
      SELECT 
        user_id,
        name,
        degree,
        role,
        survey_data,
        availability,
        free_time,
        -- Calculate total compatibility score
        (degree_score * 0.3 + role_score * 0.2 + interest_score * 0.3 + time_score * 0.2) as compatibility_score,
        degree_score,
        role_score,
        interest_score,
        time_score
      FROM availability_matches
      ORDER BY compatibility_score DESC, user_id
      LIMIT $6
    `;

    const matches = await db.query(matchQuery, [
      user_id,
      currentUser.degree || '',
      currentUser.role,
      JSON.stringify(currentUser.survey_data),
      desired_time || null,
      max_results
    ]);

    // Format response
    const formattedMatches = matches.rows.map(match => ({
      user_id: match.user_id,
      name: match.name,
      degree: match.degree,
      role: match.role,
      compatibility_score: parseFloat(match.compatibility_score.toFixed(2)),
      score_breakdown: {
        degree: match.degree_score,
        role: match.role_score,
        interests: match.interest_score,
        time: match.time_score
      },
      availability: match.availability,
      common_interests: extractCommonInterests(currentUser.survey_data, match.survey_data)
    }));

    res.json({
      matches: formattedMatches,
      total_found: matches.rows.length,
      search_criteria: {
        user_id,
        desired_time,
        activity_type,
        max_results
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /matching/suggestions:
 *   get:
 *     summary: Get general matching suggestions for user
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: List of suggested matches
 */
router.get('/suggestions', authenticateToken, requireRole(['student']), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const userId = req.user.id;

    // Get quick suggestions based on recent activity and profile
    const suggestions = await db.query(`
      SELECT 
        u.id as user_id,
        u.name,
        u.degree,
        u.role,
        p.survey_data,
        -- Simple scoring based on degree similarity and recent activity
        CASE 
          WHEN u.degree = (SELECT degree FROM users WHERE id = $1) THEN 3
          ELSE 1
        END as score
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.id != $1 
        AND u.is_active = true
        AND p.availability IS NOT NULL
      ORDER BY score DESC, RANDOM()
      LIMIT $2
    `, [userId, limit]);

    res.json({
      suggestions: suggestions.rows.map(s => ({
        user_id: s.user_id,
        name: s.name,
        degree: s.degree,
        role: s.role,
        score: s.score
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to extract common interests
function extractCommonInterests(userSurvey, matchSurvey) {
  const commonInterests = [];
  
  if (!userSurvey || !matchSurvey) return commonInterests;

  // Simple keyword matching for interests
  const userInterests = JSON.stringify(userSurvey).toLowerCase();
  const matchInterests = JSON.stringify(matchSurvey).toLowerCase();

  const keywords = ['study', 'sports', 'music', 'art', 'technology', 'science', 'social', 'gaming'];
  
  keywords.forEach(keyword => {
    if (userInterests.includes(keyword) && matchInterests.includes(keyword)) {
      commonInterests.push(keyword);
    }
  });

  return commonInterests;
}

module.exports = router;
