const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/clients', verifyToken, requireRole('cpa'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.full_name, u.created_at, COUNT(d.id) as document_count
       FROM users u LEFT JOIN documents d ON d.user_id = u.id
       WHERE u.role = 'client' GROUP BY u.id ORDER BY u.full_name ASC`
    );
    res.json({ clients: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve clients' });
  }
});

module.exports = router;