const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');
const { analyzeDocument } = require('../services/aiService');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are accepted'));
    cb(null, true);
  }
});

router.post('/upload', verifyToken, auditLog('document_upload', 'document'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'PDF file required' });
  const targetUserId = req.body.client_user_id || req.user.id;
  if (req.body.client_user_id && req.user.role !== 'cpa') return res.status(403).json({ error: 'Only CPA staff can upload on behalf of clients' });
  try {
    const pdfData = await pdfParse(req.file.buffer);
    const docResult = await db.query(
      `INSERT INTO documents (user_id, uploaded_by, original_filename, file_size_bytes, status) VALUES ($1, $2, $3, $4, 'processing') RETURNING *`,
      [targetUserId, req.user.id, req.file.originalname, req.file.size]
    );
    const document = docResult.rows[0];
    const analysis = await analyzeDocument(pdfData.text);
    await db.query(`UPDATE documents SET doc_type = $1, status = 'complete' WHERE id = $2`, [analysis.docType, document.id]);
    const analysisResult = await db.query(
      `INSERT INTO analyses (document_id, doc_type, extracted_figures, anomaly_flags, narrative_summary, cpa_recommendations, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [document.id, analysis.docType, JSON.stringify(analysis.extracted_figures), JSON.stringify(analysis.anomaly_flags),
       analysis.narrative_summary, JSON.stringify(analysis.cpa_recommendations), analysis.confidence_score]
    );
    res.status(201).json({ document: { ...document, doc_type: analysis.docType, status: 'complete' }, analysis: analysisResult.rows[0] });
  } catch (err) {
    console.error('Upload/analysis error:', err);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

router.get('/', verifyToken, auditLog('documents_list', 'document'), async (req, res) => {
  try {
    let result;
    if (req.user.role === 'cpa') {
      result = await db.query(
        `SELECT d.*, u.full_name as client_name, u.email as client_email, a.id as analysis_id, a.confidence_score, a.anomaly_flags
         FROM documents d JOIN users u ON d.user_id = u.id LEFT JOIN analyses a ON a.document_id = d.id ORDER BY d.created_at DESC`
      );
    } else {
      result = await db.query(
        `SELECT d.*, a.id as analysis_id, a.confidence_score FROM documents d LEFT JOIN analyses a ON a.document_id = d.id WHERE d.user_id = $1 ORDER BY d.created_at DESC`,
        [req.user.id]
      );
    }
    res.json({ documents: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

router.get('/admin/audit-log', verifyToken, requireRole('cpa'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT al.*, u.email, u.full_name, u.role as user_role FROM audit_log al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT 100`
    );
    res.json({ logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

router.get('/:id', verifyToken, auditLog('document_view', 'document'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, a.*, u.full_name as client_name, u.email as client_email FROM documents d JOIN users u ON d.user_id = u.id LEFT JOIN analyses a ON a.document_id = d.id WHERE d.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const doc = result.rows[0];
    if (req.user.role === 'client' && doc.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    res.json({ document: doc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
});

router.get('/:id/export', verifyToken, auditLog('document_export', 'document'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.original_filename, d.doc_type, d.created_at, u.full_name as client_name, u.email as client_email,
              a.extracted_figures, a.anomaly_flags, a.narrative_summary, a.cpa_recommendations, a.confidence_score
       FROM documents d JOIN users u ON d.user_id = u.id JOIN analyses a ON a.document_id = d.id WHERE d.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const doc = result.rows[0];
    if (req.user.role === 'client' && doc.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    res.setHeader('Content-Disposition', `attachment; filename="analysis-${req.params.id}.json"`);
    res.json({ exported_at: new Date().toISOString(), document: doc });
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;