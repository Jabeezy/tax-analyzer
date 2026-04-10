import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const DOC_TYPE_LABELS = { schedule_e: 'Schedule E', k1: 'K-1', '1040': 'Form 1040', w2_1099: 'W-2 / 1099', unknown: 'Unknown' };
const SEVERITY_COLORS = { high: '#dc2626', medium: '#d97706', low: '#2563eb' };
const DOC_TYPE_COLORS = { schedule_e: '#2563eb', k1: '#7c3aed', '1040': '#0891b2', w2_1099: '#059669', unknown: '#94a3b8' };

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
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [trashedDocs, setTrashedDocs] = useState([]);
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

  const fetchTrash = async () => {
    const res = await api.get('/documents/trash/list');
    setTrashedDocs(res.data.documents);
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Move this document to trash?')) return;
    await api.delete(`/documents/${docId}`);
    fetchDocuments();
  };

  const handleRestore = async (docId) => {
    await api.post(`/documents/${docId}/restore`);
    fetchTrash();
    fetchDocuments();
  };

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteMsg(`Invite sent to ${inviteEmail}`);
    setInviteEmail('');
    setTimeout(() => setInviteMsg(''), 3000);
  };

  const highFlagDocs = documents.filter(d => {
    try { return (d.anomaly_flags || []).some(f => f.severity === 'high'); } catch { return false; }
  });

  // Chart data
  const docTypeCounts = Object.entries(
    documents.reduce((acc, d) => { acc[d.doc_type || 'unknown'] = (acc[d.doc_type || 'unknown'] || 0) + 1; return acc; }, {})
  );
  const maxCount = Math.max(...docTypeCounts.map(([, v]) => v), 1);

  // Filtered documents
  const filteredDocs = documents.filter(doc => {
    const matchSearch = !search || doc.original_filename?.toLowerCase().includes(search.toLowerCase()) || doc.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || doc.doc_type === filterType;
    const matchSeverity = !filterSeverity || (doc.anomaly_flags || []).some(f => f.severity === filterSeverity);
    return matchSearch && matchType && matchSeverity;
  });

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarLogo}>TAX<span style={{ color: '#2563eb' }}>AI</span></div>
        <div style={styles.sidebarUser}>{user.full_name}<span style={styles.badge}>CPA</span></div>
        <nav style={styles.nav}>
          {[['documents', 'Documents'], ['analytics', 'Analytics'], ['clients', 'Clients'], ['audit', 'Audit Log'], ['trash', '🗑 Trash']].map(([key, label]) => (
            <button key={key} style={view === key ? styles.navItemActive : styles.navItem}
              onClick={() => { setView(key); if (key === 'audit') fetchAuditLog(); if (key === 'trash') fetchTrash(); }}>
              {label}
            </button>
          ))}
        </nav>
        <button style={styles.logoutBtn} onClick={logout}>Sign Out</button>
      </div>

      {/* Main */}
      <div style={styles.main}>
        {/* Upload bar */}
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

        {/* Documents view */}
        {view === 'documents' && (
          <>
            <div style={styles.stats}>
              {[['Total Documents', documents.length], ['Clients', clients.length], ['High Priority Flags', highFlagDocs.length]].map(([label, val]) => (
                <div key={label} style={styles.statCard}>
                  <div style={styles.statVal}>{val}</div>
                  <div style={styles.statLabel}>{label}</div>
                </div>
              ))}
            </div>

            {/* Search + Filter bar */}
            <div style={styles.filterBar}>
              <input style={styles.searchInput} placeholder="Search by filename or client..." value={search} onChange={e => setSearch(e.target.value)} />
              <select style={styles.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select style={styles.filterSelect} value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
                <option value="">All Flags</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
              {(search || filterType || filterSeverity) && (
                <button style={styles.clearBtn} onClick={() => { setSearch(''); setFilterType(''); setFilterSeverity(''); }}>Clear</button>
              )}
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead><tr style={styles.thead}>
                  <th style={styles.th}>Client</th><th style={styles.th}>File</th>
                  <th style={styles.th}>Type</th><th style={styles.th}>Status</th>
                  <th style={styles.th}>Flags</th><th style={styles.th}>Uploaded</th>
                  <th style={styles.th}>Actions</th>
                </tr></thead>
                <tbody>
                  {filteredDocs.length === 0 ? (
                    <tr><td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No documents match your filters</td></tr>
                  ) : filteredDocs.map(doc => {
                    const flags = doc.anomaly_flags || [];
                    const highFlags = flags.filter(f => f.severity === 'high').length;
                    const medFlags = flags.filter(f => f.severity === 'medium').length;
                    return (
                      <tr key={doc.id} style={styles.tr}>
                        <td style={styles.td}>{doc.client_name || user.full_name}</td>
                        <td style={styles.td}><span style={styles.filename}>{doc.original_filename}</span></td>
                        <td style={styles.td}><span style={styles.docTypeBadge}>{DOC_TYPE_LABELS[doc.doc_type] || '—'}</span></td>
                        <td style={styles.td}><span style={{ ...styles.statusBadge, background: doc.status === 'complete' ? '#dcfce7' : '#fef9c3', color: doc.status === 'complete' ? '#15803d' : '#854d0e' }}>{doc.status}</span></td>
                        <td style={styles.td}>
                          {highFlags > 0 && <span style={{ ...styles.flagPill, background: '#fef2f2', color: '#dc2626' }}>{highFlags} high</span>}
                          {medFlags > 0 && <span style={{ ...styles.flagPill, background: '#fffbeb', color: '#d97706' }}>{medFlags} med</span>}
                          {flags.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>—</span>}
                        </td>
                        <td style={styles.td}><span style={{ fontSize: '0.82rem', color: '#64748b' }}>{new Date(doc.created_at).toLocaleDateString()}</span></td>
                        <td style={styles.td}>
                          <button style={styles.actionBtn} onClick={() => setSelected(doc)}>View</button>
                          {doc.analysis_id && <button style={styles.actionBtn} onClick={() => handleExport(doc.id)}>Export</button>}
                          <button style={styles.deleteBtn} onClick={() => handleDelete(doc.id)}>🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Analytics view */}
        {view === 'analytics' && (
          <div style={styles.analyticsWrap}>
            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>Documents by Type</div>
              <div style={styles.chart}>
                {docTypeCounts.map(([type, count]) => (
                  <div key={type} style={styles.chartBar}>
                    <div style={styles.chartBarLabel}>{DOC_TYPE_LABELS[type] || type}</div>
                    <div style={styles.chartBarTrack}>
                      <div style={{ ...styles.chartBarFill, width: `${(count / maxCount) * 100}%`, background: DOC_TYPE_COLORS[type] || '#94a3b8' }} />
                    </div>
                    <div style={styles.chartBarCount}>{count}</div>
                  </div>
                ))}
                {docTypeCounts.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No documents yet</p>}
              </div>
            </div>

            <div style={styles.analyticsGrid}>
              <div style={styles.analyticsCard}>
                <div style={styles.analyticsCardTitle}>Flag Summary</div>
                {['high', 'medium', 'low'].map(sev => {
                  const count = documents.reduce((acc, d) => acc + (d.anomaly_flags || []).filter(f => f.severity === sev).length, 0);
                  return (
                    <div key={sev} style={styles.flagSummaryRow}>
                      <span style={{ ...styles.severityBadge, background: SEVERITY_COLORS[sev] }}>{sev.toUpperCase()}</span>
                      <span style={styles.flagSummaryCount}>{count} flags across {documents.length} documents</span>
                    </div>
                  );
                })}
              </div>

              <div style={styles.analyticsCard}>
                <div style={styles.analyticsCardTitle}>Recent Activity</div>
                {documents.slice(0, 5).map(doc => (
                  <div key={doc.id} style={styles.activityRow}>
                    <div style={styles.activityDot} />
                    <div>
                      <div style={styles.activityFile}>{doc.original_filename}</div>
                      <div style={styles.activityMeta}>{doc.client_name || user.full_name} · {new Date(doc.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
                {documents.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No activity yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* Clients view */}
        {view === 'clients' && (
          <>
            {/* Invite client */}
            <div style={styles.inviteBar}>
              <div style={styles.inviteTitle}>Invite a Client</div>
              <form onSubmit={handleInvite} style={styles.inviteForm}>
                <input style={styles.inviteInput} type="email" placeholder="client@email.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
                <button style={styles.inviteBtn} type="submit">Send Invite</button>
              </form>
              {inviteMsg && <span style={styles.uploadMsg}>{inviteMsg}</span>}
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead><tr style={styles.thead}>
                  <th style={styles.th}>Name</th><th style={styles.th}>Email</th><th style={styles.th}>Documents</th><th style={styles.th}>Member Since</th>
                </tr></thead>
                <tbody>
                  {clients.length === 0 ? (
                    <tr><td colSpan={4} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No clients yet — invite one above</td></tr>
                  ) : clients.map(c => (
                    <tr key={c.id} style={styles.tr}>
                      <td style={styles.td}><span style={styles.clientName}>{c.full_name}</span></td>
                      <td style={styles.td}>{c.email}</td>
                      <td style={styles.td}><span style={styles.docCountBadge}>{c.document_count} docs</span></td>
                      <td style={styles.td}>{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Trash view */}
        {view === 'trash' && (
          <div>
            <div style={styles.trashHeader}>
              <div style={styles.trashTitle}>🗑 Trash</div>
              <div style={styles.trashSub}>Deleted documents can be restored at any time.</div>
            </div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead><tr style={styles.thead}>
                  <th style={styles.th}>Client</th><th style={styles.th}>File</th>
                  <th style={styles.th}>Type</th><th style={styles.th}>Deleted</th>
                  <th style={styles.th}>Actions</th>
                </tr></thead>
                <tbody>
                  {trashedDocs.length === 0 ? (
                    <tr><td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Trash is empty</td></tr>
                  ) : trashedDocs.map(doc => (
                    <tr key={doc.id} style={styles.tr}>
                      <td style={styles.td}>{doc.client_name || user.full_name}</td>
                      <td style={styles.td}><span style={styles.filename}>{doc.original_filename}</span></td>
                      <td style={styles.td}><span style={styles.docTypeBadge}>{DOC_TYPE_LABELS[doc.doc_type] || '—'}</span></td>
                      <td style={styles.td}><span style={{ fontSize: '0.82rem', color: '#64748b' }}>{new Date(doc.deleted_at).toLocaleDateString()}</span></td>
                      <td style={styles.td}>
                        <button style={styles.restoreBtn} onClick={() => handleRestore(doc.id)}>↩ Restore</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit log view */}
        {view === 'audit' && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead><tr style={styles.thead}>
                <th style={styles.th}>Time</th><th style={styles.th}>User</th><th style={styles.th}>Role</th><th style={styles.th}>Action</th><th style={styles.th}>IP</th>
              </tr></thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id} style={styles.tr}>
                    <td style={styles.td}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={styles.td}>{log.email || 'anonymous'}</td>
                    <td style={styles.td}>{log.user_role && <span style={{ ...styles.docTypeBadge, background: log.user_role === 'cpa' ? '#eff6ff' : '#f0fdf4', color: log.user_role === 'cpa' ? '#1d4ed8' : '#15803d' }}>{log.user_role}</span>}</td>
                    <td style={styles.td}><code style={{ fontSize: '0.82rem', background: '#f8fafc', padding: '2px 6px', borderRadius: '3px' }}>{log.action}</code></td>
                    <td style={styles.td}><span style={{ fontSize: '0.82rem', color: '#64748b' }}>{log.ip_address}</span></td>
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

  const handlePrint = () => {
    const content = document.getElementById('print-analysis');
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Analysis - ${analysis?.original_filename}</title>
    <style>body{font-family:system-ui,sans-serif;padding:2rem;color:#1e293b;max-width:800px;margin:0 auto}
    h1{font-size:1.4rem;margin-bottom:0.25rem}h2{font-size:1rem;color:#64748b;margin:1.5rem 0 0.75rem;text-transform:uppercase;letter-spacing:0.05em;font-size:0.75rem}
    p{line-height:1.7;color:#475569;font-size:0.9rem}.flag{border-left:4px solid #dc2626;padding:0.75rem 1rem;margin-bottom:0.75rem;background:#fafafa;border-radius:0 6px 6px 0}
    .flag.medium{border-color:#d97706}.flag.low{border-color:#2563eb}.rec{display:flex;gap:0.75rem;margin-bottom:0.75rem}
    .num{background:#eff6ff;color:#1d4ed8;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0}
    table{width:100%;border-collapse:collapse;margin-bottom:1rem}td{padding:0.5rem 0.75rem;border-bottom:1px solid #f1f5f9;font-size:0.85rem}
    td:last-child{text-align:right;font-weight:600}.meta{color:#64748b;font-size:0.85rem;margin-bottom:2rem}
    @media print{body{padding:1rem}}</style></head><body>`);
    w.document.write(content.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  if (!analysis) return <div style={styles.panel}><div style={{ padding: '2rem', color: '#64748b' }}>Loading...</div></div>;

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
        <div id="print-analysis">
          <h1 style={{ display: 'none' }}>{analysis.original_filename}</h1>
          <p style={{ display: 'none' }} className="meta">{DOC_TYPE_LABELS[analysis.doc_type]} · {analysis.client_name} · {new Date(analysis.created_at).toLocaleDateString()}</p>

          <Section title="Summary"><p style={styles.summaryText}>{analysis.narrative_summary}</p></Section>

          {flags.length > 0 && (
            <Section title={`Anomaly Flags (${flags.length})`}>
              {flags.map((f, i) => (
                <div key={i} style={{ ...styles.flag, borderLeft: `4px solid ${SEVERITY_COLORS[f.severity] || '#ccc'}` }} className={`flag ${f.severity}`}>
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
                <div key={i} style={styles.rec} className="rec">
                  <span style={styles.recNum} className="num">{i + 1}</span>
                  <p style={styles.recText}>{r}</p>
                </div>
              ))}
            </Section>
          )}

          <Section title="Extracted Figures">
            <FiguresTable figures={figures} docType={analysis.doc_type} />
          </Section>
        </div>

        <div style={styles.actionRow}>
          <button style={styles.printBtn} onClick={handlePrint}>Print / Save PDF</button>
          <button style={styles.exportBtn} onClick={() => onExport(doc.id)}>Export JSON</button>
        </div>
      </div>
    </div>
  );
}

function FiguresTable({ figures, docType }) {
  if (!figures || Object.keys(figures).length === 0) return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No figures extracted</p>;

  if (docType === 'schedule_e') return (
    <div>
      {(figures.properties || []).map((p, i) => (
        <div key={i} style={styles.figureCard}>
          <div style={styles.figureAddress}>{p.address}</div>
          <div style={styles.figureRow}><span>Rental Income</span><span style={styles.figurePos}>${p.rental_income?.toLocaleString()}</span></div>
          <div style={styles.figureRow}><span>Total Expenses</span><span style={styles.figureNeg}>${p.total_expenses?.toLocaleString()}</span></div>
          <div style={{ ...styles.figureRow, borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', fontWeight: 600 }}><span>Net Income</span><span style={styles.figurePos}>${p.net_income?.toLocaleString()}</span></div>
        </div>
      ))}
      <div style={styles.figureSummary}>
        {[['Total Rental Income', figures.total_rental_income, true], ['Total Expenses', figures.total_expenses, false], ['Net Income', figures.total_net_income, true], ['Depreciation Claimed', figures.depreciation_claimed, null], ['Mortgage Interest', figures.mortgage_interest, null]].map(([label, val, pos]) => (
          <div key={label} style={styles.summaryRow}>
            <span style={styles.summaryLabel}>{label}</span>
            <span style={{ ...styles.summaryVal, color: pos === true ? '#15803d' : pos === false ? '#dc2626' : '#334155' }}>${val?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (docType === 'k1') return (
    <div style={styles.figureSummary}>
      {[
        ['Partnership', figures.partnership_name, null],
        ['Ownership %', `${figures.ownership_percentage}%`, null],
        ['Ordinary Income', `$${figures.ordinary_income?.toLocaleString()}`, true],
        ['Net Rental Income', `$${figures.net_rental_income?.toLocaleString()}`, true],
        ['Long-Term Capital Gains', `$${figures.capital_gains_long_term?.toLocaleString()}`, true],
        ['Section 179 Deduction', `$${figures.section_179_deduction?.toLocaleString()}`, null],
        ['Distributions', `$${figures.distributions?.toLocaleString()}`, null],
        ['Beginning Capital', `$${figures.beginning_capital?.toLocaleString()}`, null],
        ['Ending Capital', `$${figures.ending_capital?.toLocaleString()}`, null],
      ].map(([label, val, pos]) => (
        <div key={label} style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{label}</span>
          <span style={{ ...styles.summaryVal, color: pos === true ? '#15803d' : '#334155' }}>{val}</span>
        </div>
      ))}
    </div>
  );

  if (docType === '1040') return (
    <div style={styles.figureSummary}>
      {[
        ['Filing Status', figures.filing_status, null],
        ['Tax Year', figures.tax_year, null],
        ['Wages', `$${figures.wages?.toLocaleString()}`, null],
        ['Business Income', `$${figures.business_income?.toLocaleString()}`, null],
        ['Rental Income', `$${figures.rental_income?.toLocaleString()}`, null],
        ['Capital Gains', `$${figures.capital_gains?.toLocaleString()}`, null],
        ['AGI', `$${figures.agi?.toLocaleString()}`, null],
        ['Standard Deduction', `$${figures.standard_deduction?.toLocaleString()}`, null],
        ['Taxable Income', `$${figures.taxable_income?.toLocaleString()}`, null],
        ['Total Tax', `$${figures.total_tax?.toLocaleString()}`, false],
        ['Effective Rate', figures.effective_tax_rate, null],
        ['Withholding', `$${figures.withholding?.toLocaleString()}`, null],
        [figures.refund_or_owed?.type === 'owed' ? 'Balance Due' : 'Refund', `$${figures.refund_or_owed?.amount?.toLocaleString()}`, figures.refund_or_owed?.type !== 'owed'],
      ].map(([label, val, pos]) => (
        <div key={label} style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{label}</span>
          <span style={{ ...styles.summaryVal, color: pos === true ? '#15803d' : pos === false ? '#dc2626' : '#334155' }}>{val}</span>
        </div>
      ))}
    </div>
  );

  if (docType === 'w2_1099') return (
    <div>
      {(figures.documents_detected || []).map((d, i) => (
        <div key={i} style={styles.figureCard}>
          <div style={styles.figureAddress}>{d.type} — {d.employer || d.payer}</div>
          {d.box1_wages && <div style={styles.figureRow}><span>Wages (Box 1)</span><span>${d.box1_wages?.toLocaleString()}</span></div>}
          {d.box2_federal_withheld && <div style={styles.figureRow}><span>Federal Withheld (Box 2)</span><span style={styles.figureNeg}>${d.box2_federal_withheld?.toLocaleString()}</span></div>}
          {d.box4_ss_withheld && <div style={styles.figureRow}><span>SS Withheld (Box 4)</span><span>${d.box4_ss_withheld?.toLocaleString()}</span></div>}
          {d.box6_medicare_withheld && <div style={styles.figureRow}><span>Medicare Withheld (Box 6)</span><span>${d.box6_medicare_withheld?.toLocaleString()}</span></div>}
          {d.box17_state_tax && <div style={styles.figureRow}><span>State Tax (Box 17)</span><span>${d.box17_state_tax?.toLocaleString()}</span></div>}
          {d.box1_interest && <div style={styles.figureRow}><span>Interest Income</span><span style={styles.figurePos}>${d.box1_interest?.toLocaleString()}</span></div>}
          {d.box1a_total_dividends && <div style={styles.figureRow}><span>Total Dividends</span><span style={styles.figurePos}>${d.box1a_total_dividends?.toLocaleString()}</span></div>}
          {d.box1b_qualified_dividends && <div style={styles.figureRow}><span>Qualified Dividends</span><span style={styles.figurePos}>${d.box1b_qualified_dividends?.toLocaleString()}</span></div>}
        </div>
      ))}
    </div>
  );

  return <pre style={styles.pre}>{JSON.stringify(figures, null, 2)}</pre>;
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
  filterBar: { display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' },
  searchInput: { flex: 2, padding: '0.55rem 0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '0.88rem', minWidth: '200px' },
  filterSelect: { padding: '0.55rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '0.88rem', background: '#fff' },
  clearBtn: { padding: '0.55rem 0.85rem', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569' },
  tableWrap: { background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f1f5f9' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '0.85rem 1rem', fontSize: '0.88rem', color: '#334155' },
  filename: { fontFamily: 'monospace', fontSize: '0.82rem', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' },
  docTypeBadge: { background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500' },
  statusBadge: { padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500' },
  flagPill: { padding: '2px 7px', borderRadius: '4px', fontSize: '0.76rem', fontWeight: '600', marginRight: '0.25rem' },
  actionBtn: { padding: '0.3rem 0.75rem', background: '#f1f5f9', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', marginRight: '0.4rem', color: '#334155' },
  clientName: { fontWeight: '600', color: '#0f172a' },
  docCountBadge: { background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500' },
  inviteBar: { background: '#fff', padding: '1.25rem', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.5rem' },
  inviteTitle: { fontWeight: '600', fontSize: '0.9rem', color: '#0f172a', marginBottom: '0.75rem' },
  inviteForm: { display: 'flex', gap: '0.75rem' },
  inviteInput: { flex: 1, padding: '0.6rem 0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem' },
  inviteBtn: { padding: '0.6rem 1.25rem', background: '#0f1923', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' },
  analyticsWrap: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  chartCard: { background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  chartTitle: { fontWeight: '700', fontSize: '0.95rem', color: '#0f172a', marginBottom: '1.25rem' },
  chart: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  chartBar: { display: 'flex', alignItems: 'center', gap: '1rem' },
  chartBarLabel: { width: '110px', fontSize: '0.85rem', color: '#475569', flexShrink: 0, textAlign: 'right' },
  chartBarTrack: { flex: 1, background: '#f1f5f9', borderRadius: '4px', height: '28px', overflow: 'hidden' },
  chartBarFill: { height: '100%', borderRadius: '4px', transition: 'width 0.5s ease', minWidth: '4px' },
  chartBarCount: { width: '32px', fontSize: '0.88rem', fontWeight: '700', color: '#0f172a' },
  analyticsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },
  analyticsCard: { background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  analyticsCardTitle: { fontWeight: '700', fontSize: '0.95rem', color: '#0f172a', marginBottom: '1rem' },
  flagSummaryRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' },
  flagSummaryCount: { fontSize: '0.85rem', color: '#475569' },
  activityRow: { display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'flex-start' },
  activityDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', marginTop: '5px', flexShrink: 0 },
  activityFile: { fontSize: '0.85rem', fontWeight: '500', color: '#334155' },
  activityMeta: { fontSize: '0.78rem', color: '#94a3b8' },
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
  actionRow: { display: 'flex', gap: '0.75rem', marginTop: '0.5rem' },
  printBtn: { flex: 1, padding: '0.75rem', background: '#fff', color: '#0f1923', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' },
  exportBtn: { flex: 1, padding: '0.75rem', background: '#0f1923', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' },
  figureCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' },
  figureAddress: { fontWeight: '600', fontSize: '0.88rem', color: '#0f172a', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' },
  figureRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569', padding: '0.25rem 0' },
  figurePos: { color: '#15803d', fontWeight: '600' },
  figureNeg: { color: '#dc2626', fontWeight: '600' },
  figureSummary: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '0.6rem 1rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' },
  deleteBtn: { padding: '0.3rem 0.6rem', background: '#fef2f2', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', color: '#dc2626' },
  restoreBtn: { padding: '0.3rem 0.75rem', background: '#f0fdf4', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', color: '#15803d', fontWeight: '600' },
  trashHeader: { marginBottom: '1.25rem' },
  trashTitle: { fontWeight: '700', fontSize: '1.1rem', color: '#0f172a', marginBottom: '0.25rem' },
  trashSub: { fontSize: '0.85rem', color: '#64748b' },
  summaryLabel: { color: '#64748b' },
  summaryVal: { fontWeight: '600', color: '#334155' },
};