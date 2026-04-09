const db = require('../db');

const auditLog = (action, resourceType = null) => {
  return async (req, res, next) => {
    res.on('finish', async () => {
      try {
        const userId = req.user?.id || null;
        const resourceId = req.params?.id || req.body?.documentId || null;
        const ip = req.ip || req.connection.remoteAddress;
        await db.query(
          `INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, action, resourceType, resourceId, ip,
            JSON.stringify({ method: req.method, path: req.path, status: res.statusCode })]
        );
      } catch (err) {
        console.error('Audit log error:', err.message);
      }
    });
    next();
  };
};

module.exports = auditLog;