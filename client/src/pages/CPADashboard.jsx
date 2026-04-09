import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const DOC_TYPE_LABELS = { schedule_e: 'Schedule E', k1: 'K-1', '1040': 'Form 1040', w2_1099: 'W-2 / 1099', unknown: 'Unknown' };
const SEVERITY_COLORS = { high: '#dc2626', medium: '#d97706', low: '#2563eb' };

export default function CPADashboard() {
  const { user, logout } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('documents');
  const [auditLogs, setAuditLogs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [clientId, setClientId] = useState('');
  const fileRef = useRef();

  useEffect(() => { fetchDocuments(); fetchClients(); }, []);

  const fetchDocuments = async () => {
    const res = await api.get('/documents');
    setDocuments(res.data.documents);
  };

  const fetchClients = async () => {
    const res = await api.get('/users/clients');
    setClients(res.data.clients);
  };

  const fetchAuditLog = async () => {
    const res = await api.get('/documents/admin/audit-log');
    setAuditLogs(res.data.logs);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('Analyzing document...');
    const form = new FormData();
    form.append('file', file);
    if (clientId) form.append('client_user_id', clientId);
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

  const handleExport = async (docId) => {
    const res = await api.get(`/documents/${docId}/export`);
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `analysis-${docId}.json`; a.click();
  };

  const highFlagDocs = documents.filter(d => {
    try { return (d.anomaly_flags || []).some(f => f.severity === 'high'); } catch { return false; }
  });

  return (
    <div style={styles.page}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarLogo}>TAX<span style={{ color: '#2563eb' }}>AI</span></div>
        <div style={styles.sidebarUser}>{user.full_name}<span style={styles.badge}>CPA</span></div>
        <nav style={styles.nav}>
          {[['documents', 'Documents'], ['clients', 'Clients'], ['audit', 'Audit Log']].map(([key, label]) => (
            <button key={key} style={view === key ? styles.navItemActive : styles.navItem}
              onClick={() => { setView(key); if (key === 'audit') fetchAuditLog(); }}>
              {label}
            </button>
          ))}
        </nav>
        <button style={styles.logoutBtn} onClick={logout}>Sign Out</button>
      </div>

      <div style={styles.main}>
        <div style={styles.uploadBar}>
          <select style={styles.clientSelect} value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Upload for yourself</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>)}
          </select>
          <label style={{ ...styles.uploadBtn, opacity: uploading ? 0.7 : 1 }}>
            {uploading ? 'Analyzing...' : '+ Upload PDF'}
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          </label>
          {uploadMsg && <span style={styles.uploadMsg}>{uploadMsg}</span>}
        </div>

        {view === 'documents' && (
          <div style={styles.stats}>
            {[['Total Documents', documents.length], ['Clients', clients.length], ['High Priority Flags', highFlagDocs.length]].map(([label, val]) => (
              <div key={label} style={styles.statCard}>
                <div style={styles.statVal}>{val}</div>
                <div style={styles.statLabel}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {view === 'documents' && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead><tr style={styles.thead}>
                <th style={styles.th}>Client</th><th style={styles.th}>File</th>
                <th style={styles.th}>Type</th><th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr></thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} style={styles.tr}>
                    <td style={styles.td}>{doc.client_name || user.full_name}</td>
                    <td style={styles.td}><span style={styles.filename}>{doc.original_filename}</span></td>
                    <td style={styles.td}><span style={styles.docTypeBadge}>{DOC_TYPE_LABELS[doc.doc_type] || '—'}</span></td>
                    <td style={styles.td}><span style={{ ...styles.statusBadge, background: doc.status === 'complete' ? '#dcfce7' : '#fef9c3', color: doc.status === 'complete' ? '#15803d' : '#854d0e' }}>{doc.status}</span></td>
                    <td style={styles.td}>
                      <button style={styles.actionBtn} onClick={() => setSelected(doc)}>View</button>
                      {doc.analysis_id && <button style={styles.actionBtn} onClick={() => handleExport(doc.id)}>Export</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'clients' && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead><tr style={styles.thead}>
                <th style={styles.th}>Name</th><th style={styles.th}>Email</th><th style={styles.th}>Documents</th><th style={styles.th}>Since</th>
              </tr></thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} style={styles.tr}>
                    <td style={styles.td}>{c.full_name}</td>
                    <td style={styles.td}>{c.email}</td>
                    <td style={styles.td}>{c.document_count}</td>
                    <td style={styles.td}>{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'audit' && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead><tr style={styles.thead}>
                <th style={styles.th}>Time</th><th style={styles.th}>User</th><th style={styles.th}>Action</th><th style={styles.th}>IP</th>
              </tr></thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id} style={styles.tr}>
                    <td style={styles.td}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={styles.td}>{log.email || 'anonymous'}</td>
                    <td style={styles.td}><code style={{ fontSize: '0.82rem' }}>{log.action}</code></td>
                    <td style={styles.td}>{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <AnalysisPanel doc={selected} onClose={() => setSelected(null)} onExport={handleExport} />}
    </div>
  );
}

function AnalysisPanel({ doc, onClose, onExport }) {
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    api.get(`/documents/${doc.id}`).then(res => setAnalysis(res.data.document));
  }, [doc.id]);

  if (!analysis) return null;

  const flags = analysis.anomaly_flags || [];
  const recs = analysis.cpa_recommendations || [];
  const figures = analysis.extracted_figures || {};

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <div style={styles.panelTitle}>{analysis.original_filename}</div>
          <div style={styles.panelMeta}>{DOC_TYPE_LABELS[analysis.doc_type]} · {analysis.client_name} · Confidence: {Math.round((analysis.confidence_score || 0) * 100)}%</div>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>
      <div style={styles.panelBody}>
        <Section title="Summary"><p style={styles.summaryText}>{analysis.narrative_summary}</p></Section>
        {flags.length > 0 && (
          <Section title={`Anomaly Flags (${flags.length})`}>
            {flags.map((f, i) => (
              <div key={i} style={{ ...styles.flag, borderLeft: `4px solid ${SEVERITY_COLORS[f.severity] || '#ccc'}` }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ ...styles.severityBadge, background: SEVERITY_COLORS[f.severity] }}>{f.severity.toUpperCase()}</span>
                  <strong style={{ fontSize: '0.9rem' }}>{f.field}</strong>
                </div>
                <p style={styles.flagMsg}>{f.message}</p>
              </div>
            ))}
          </Section>
        )}
        {recs.length > 0 && (
          <Section title="CPA Recommendations">
            {recs.map((r, i) => (
              <div key={i} style={styles.rec}>
                <span style={styles.recNum}>{i + 1}</span>
                <p style={styles.recText}>{r}</p>
              </div>
            ))}
          </Section>
        )}
        <Section title="Extracted Figures">
          <pre style={styles.pre}>{JSON.stringify(figures, null, 2)}</pre>
        </Section>
        <button style={styles.exportBtn} onClick={() => onExport(doc.id)}>Export Analysis JSON</button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

const styles = {
  page: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: '220px', background: '#0f1923', color: '#fff', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', flexShrink: 0 },
  sidebarLogo: { fontSize: '1.4rem', fontWeight: '700', letterSpacing: '-0.5px', padding: '0.5rem 0' },
  sidebarUser: { fontSize: '0.82rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  badge: { background: '#1e40af', color: '#bfdbfe', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', width: 'fit-content' },
  nav: { display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '1rem', flex: 1 },
  navItem: { padding: '0.6rem 0.75rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: '6px', textAlign: 'left', fontSize: '0.9rem' },
  navItemActive: { padding: '0.6rem 0.75rem', background: '#1e293b', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '6px', textAlign: 'left', fontSize: '0.9rem', fontWeight: '600' },
  logoutBtn: { padding: '0.6rem', background: 'none', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' },
  main: { flex: 1, padding: '1.5rem', overflow: 'auto' },
  uploadBar: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: '#fff', padding: '1rem 1.25rem', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  clientSelect: { padding: '0.5rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem', flex: 1 },
  uploadBtn: { padding: '0.6rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap' },
  uploadMsg: { color: '#15803d', fontSize: '0.9rem', fontWeight: '500' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' },
  statCard: { background: '#fff', padding: '1.25rem', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  statVal: { fontSize: '2rem', fontWeight: '700', color: '#0f172a' },
  statLabel: { fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' },
  tableWrap: { background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f1f5f9' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '0.85rem 1rem', fontSize: '0.88rem', color: '#334155' },
  filename: { fontFamily: 'monospace', fontSize: '0.82rem', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' },
  docTypeBadge: { background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500' },
  statusBadge: { padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500' },
  actionBtn: { padding: '0.3rem 0.75rem', background: '#f1f5f9', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', marginRight: '0.4rem', color: '#334155' },
  panel: { width: '480px', background: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  panelHeader: { padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  panelTitle: { fontWeight: '700', fontSize: '1rem', color: '#0f172a' },
  panelMeta: { fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' },
  panelBody: { padding: '1.5rem', overflow: 'auto', flex: 1 },
  sectionTitle: { fontWeight: '700', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.75rem' },
  summaryText: { fontSize: '0.9rem', color: '#334155', lineHeight: '1.7', margin: 0 },
  flag: { background: '#fafafa', padding: '0.85rem 1rem', borderRadius: '6px', marginBottom: '0.75rem' },
  severityBadge: { color: '#fff', padding: '1px 7px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: '700' },
  flagMsg: { fontSize: '0.87rem', color: '#475569', margin: 0, lineHeight: '1.6' },
  rec: { display: 'flex', gap: '0.75rem', marginBottom: '0.85rem', alignItems: 'flex-start' },
  recNum: { background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', flexShrink: 0, marginTop: '2px' },
  recText: { fontSize: '0.87rem', color: '#334155', margin: 0, lineHeight: '1.6' },
  pre: { background: '#f8fafc', padding: '1rem', borderRadius: '6px', fontSize: '0.78rem', overflow: 'auto', color: '#334155' },
  exportBtn: { width: '100%', padding: '0.75rem', background: '#0f1923', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }
};