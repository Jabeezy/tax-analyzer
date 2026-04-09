import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const DOC_TYPE_LABELS = { schedule_e: 'Schedule E', k1: 'K-1', '1040': 'Form 1040', w2_1099: 'W-2 / 1099', unknown: 'Unknown' };
const SEVERITY_COLORS = { high: '#dc2626', medium: '#d97706', low: '#2563eb' };

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => { fetchDocuments(); }, []);

  const fetchDocuments = async () => {
    const res = await api.get('/documents');
    setDocuments(res.data.documents);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('Analyzing your document...');
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post('/documents/upload', form);
      setUploadMsg('Analysis complete!');
      fetchDocuments();
      setTimeout(() => setUploadMsg(''), 3000);
    } catch (err) {
      setUploadMsg(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      fileRef.current.value = '';
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.logo}>TAX<span style={{ color: '#2563eb' }}>AI</span></div>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user.full_name}</span>
          <button style={styles.logoutBtn} onClick={logout}>Sign Out</button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Your Tax Documents</h1>
          <p style={styles.heroSub}>Upload a tax document for instant AI-powered analysis and CPA review.</p>
          <label style={{ ...styles.uploadBtn, opacity: uploading ? 0.7 : 1 }}>
            {uploading ? 'Analyzing...' : '+ Upload PDF'}
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          </label>
          {uploadMsg && <p style={styles.uploadMsg}>{uploadMsg}</p>}
        </div>

        {documents.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>📄</div>
            <p>No documents uploaded yet. Upload your first tax document to get started.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {documents.map(doc => (
              <div key={doc.id} style={styles.docCard} onClick={() => setSelected(doc)}>
                <div style={styles.docCardHeader}>
                  <span style={styles.docTypeBadge}>{DOC_TYPE_LABELS[doc.doc_type] || 'Processing'}</span>
                  <span style={{ ...styles.statusDot, background: doc.status === 'complete' ? '#22c55e' : '#f59e0b' }} />
                </div>
                <div style={styles.docFilename}>{doc.original_filename}</div>
                <div style={styles.docDate}>{new Date(doc.created_at).toLocaleDateString()}</div>
                {doc.analysis_id && (
                  <div style={styles.docMeta}>Confidence: {Math.round((doc.confidence_score || 0) * 100)}%</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <ClientAnalysisPanel doc={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ClientAnalysisPanel({ doc, onClose }) {
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    api.get(`/documents/${doc.id}`).then(res => setAnalysis(res.data.document));
  }, [doc.id]);

  if (!analysis) return <div style={styles.overlay}><div style={styles.modal}><p>Loading...</p></div></div>;

  const flags = analysis.anomaly_flags || [];
  const recs = analysis.cpa_recommendations || [];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{analysis.original_filename}</div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.confidenceBar}>
            <span>Analysis confidence</span>
            <span style={styles.confidenceVal}>{Math.round((analysis.confidence_score || 0) * 100)}%</span>
          </div>
          <div style={styles.sectionTitle}>Summary</div>
          <p style={styles.summaryText}>{analysis.narrative_summary}</p>
          {flags.length > 0 && (
            <>
              <div style={styles.sectionTitle}>Items for Review ({flags.length})</div>
              {flags.map((f, i) => (
                <div key={i} style={{ ...styles.flag, borderLeft: `4px solid ${SEVERITY_COLORS[f.severity] || '#ccc'}` }}>
                  <strong style={{ fontSize: '0.88rem' }}>{f.field}</strong>
                  <p style={styles.flagMsg}>{f.message}</p>
                </div>
              ))}
            </>
          )}
          {recs.length > 0 && (
            <>
              <div style={styles.sectionTitle}>Recommendations</div>
              {recs.map((r, i) => (
                <div key={i} style={styles.rec}>
                  <span style={styles.recNum}>{i + 1}</span>
                  <p style={styles.recText}>{r}</p>
                </div>
              ))}
            </>
          )}
          <p style={styles.disclaimer}>This analysis is generated by AI and should be reviewed by your CPA before filing.</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' },
  header: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: '1.4rem', fontWeight: '700', letterSpacing: '-0.5px', color: '#0f1923' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
  userName: { fontSize: '0.9rem', color: '#64748b' },
  logoutBtn: { padding: '0.4rem 0.85rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', color: '#64748b' },
  content: { maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' },
  hero: { textAlign: 'center', padding: '2rem 0 3rem' },
  heroTitle: { fontSize: '2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' },
  heroSub: { color: '#64748b', fontSize: '1rem', marginBottom: '1.5rem' },
  uploadBtn: { display: 'inline-block', padding: '0.8rem 2rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' },
  uploadMsg: { color: '#15803d', marginTop: '1rem', fontWeight: '500' },
  empty: { textAlign: 'center', padding: '3rem', color: '#94a3b8' },
  emptyIcon: { fontSize: '3rem', marginBottom: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' },
  docCard: { background: '#fff', borderRadius: '10px', padding: '1.25rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  docCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  docTypeBadge: { background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '500' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%' },
  docFilename: { fontSize: '0.85rem', color: '#334155', fontWeight: '500', marginBottom: '0.4rem', wordBreak: 'break-all' },
  docDate: { fontSize: '0.78rem', color: '#94a3b8' },
  docMeta: { fontSize: '0.78rem', color: '#64748b', marginTop: '0.5rem' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' },
  modal: { background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' },
  modalBody: { padding: '1.5rem', overflow: 'auto' },
  confidenceBar: { display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.88rem', color: '#64748b' },
  confidenceVal: { fontWeight: '700', color: '#15803d' },
  sectionTitle: { fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.75rem', marginTop: '1.25rem' },
  summaryText: { fontSize: '0.9rem', color: '#334155', lineHeight: '1.7', margin: 0 },
  flag: { background: '#fafafa', padding: '0.85rem 1rem', borderRadius: '6px', marginBottom: '0.75rem' },
  flagMsg: { fontSize: '0.87rem', color: '#475569', margin: '0.25rem 0 0', lineHeight: '1.6' },
  rec: { display: 'flex', gap: '0.75rem', marginBottom: '0.85rem', alignItems: 'flex-start' },
  recNum: { background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', flexShrink: 0, marginTop: '2px' },
  recText: { fontSize: '0.87rem', color: '#334155', margin: 0, lineHeight: '1.6' },
  disclaimer: { fontSize: '0.78rem', color: '#94a3b8', marginTop: '1.5rem', fontStyle: 'italic', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }
};