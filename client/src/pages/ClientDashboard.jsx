import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const DOC_TYPE_LABELS = { schedule_e: 'Schedule E', k1: 'K-1', '1040': 'Form 1040', w2_1099: 'W-2 / 1099', unknown: 'Unknown' };
const SEVERITY_COLORS = { high: '#dc2626', medium: '#d97706', low: '#2563eb' };
const DOC_TYPE_COLORS = { schedule_e: '#2563eb', k1: '#7c3aed', '1040': '#0891b2', w2_1099: '#059669', unknown: '#94a3b8' };

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
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

  const filteredDocs = documents.filter(doc => {
    const matchSearch = !search || doc.original_filename?.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || doc.doc_type === filterType;
    return matchSearch && matchType;
  });

  const highFlagCount = documents.reduce((acc, d) => acc + (d.anomaly_flags || []).filter(f => f.severity === 'high').length, 0);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>TAX<span style={{ color: '#2563eb' }}>AI</span></div>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user.full_name}</span>
          <button style={styles.logoutBtn} onClick={logout}>Sign Out</button>
        </div>
      </div>

      <div style={styles.content}>
        {/* Hero upload */}
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Your Tax Documents</h1>
          <p style={styles.heroSub}>Upload a tax document for instant AI-powered analysis and CPA review.</p>
          <label style={{ ...styles.uploadBtn, opacity: uploading ? 0.7 : 1 }}>
            {uploading ? 'Analyzing...' : '+ Upload PDF'}
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          </label>
          {uploadMsg && <p style={styles.uploadMsg}>{uploadMsg}</p>}
        </div>

        {/* Stats row */}
        {documents.length > 0 && (
          <div style={styles.statsRow}>
            {[
              ['Documents', documents.length],
              ['Analyzed', documents.filter(d => d.status === 'complete').length],
              ['Items to Review', highFlagCount]
            ].map(([label, val]) => (
              <div key={label} style={styles.statCard}>
                <div style={styles.statVal}>{val}</div>
                <div style={styles.statLabel}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search + filter */}
        {documents.length > 0 && (
          <div style={styles.filterBar}>
            <input style={styles.searchInput} placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
            <select style={styles.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {(search || filterType) && (
              <button style={styles.clearBtn} onClick={() => { setSearch(''); setFilterType(''); }}>Clear</button>
            )}
          </div>
        )}

        {/* Documents grid */}
        {documents.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>📄</div>
            <div style={styles.emptyTitle}>No documents yet</div>
            <p style={styles.emptySub}>Upload your first tax document above to get started. We support Schedule E, K-1, Form 1040, and W-2/1099.</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>🔍</div>
            <p style={{ color: '#94a3b8' }}>No documents match your search</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredDocs.map(doc => {
              const flags = doc.anomaly_flags || [];
              const highFlags = flags.filter(f => f.severity === 'high').length;
              const medFlags = flags.filter(f => f.severity === 'medium').length;
              return (
                <div key={doc.id} style={styles.docCard} onClick={() => setSelected(doc)}>
                  <div style={styles.docCardHeader}>
                    <span style={{ ...styles.docTypeBadge, background: `${DOC_TYPE_COLORS[doc.doc_type]}18`, color: DOC_TYPE_COLORS[doc.doc_type] }}>
                      {DOC_TYPE_LABELS[doc.doc_type] || 'Processing'}
                    </span>
                    <span style={{ ...styles.statusDot, background: doc.status === 'complete' ? '#22c55e' : '#f59e0b' }} />
                  </div>
                  <div style={styles.docFilename}>{doc.original_filename}</div>
                  <div style={styles.docDate}>{new Date(doc.created_at).toLocaleDateString()}</div>
                  <div style={styles.docFooter}>
                    {doc.analysis_id && (
                      <span style={styles.confidenceTag}>
                        {Math.round((doc.confidence_score || 0) * 100)}% confidence
                      </span>
                    )}
                    <div style={styles.flagRow}>
                      {highFlags > 0 && <span style={{ ...styles.flagPill, background: '#fef2f2', color: '#dc2626' }}>{highFlags} high</span>}
                      {medFlags > 0 && <span style={{ ...styles.flagPill, background: '#fffbeb', color: '#d97706' }}>{medFlags} med</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline */}
        {documents.length > 0 && (
          <div style={styles.timelineSection}>
            <div style={styles.timelineTitle}>Document History</div>
            <div style={styles.timeline}>
              {documents.slice().reverse().map((doc, i) => (
                <div key={doc.id} style={styles.timelineItem}>
                  <div style={styles.timelineDot} />
                  {i < documents.length - 1 && <div style={styles.timelineLine} />}
                  <div style={styles.timelineContent}>
                    <div style={styles.timelineFile}>{doc.original_filename}</div>
                    <div style={styles.timelineMeta}>
                      {DOC_TYPE_LABELS[doc.doc_type] || 'Unknown'} · Uploaded {new Date(doc.created_at).toLocaleDateString()} ·
                      <span style={{ color: doc.status === 'complete' ? '#15803d' : '#d97706', marginLeft: '4px' }}>{doc.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

  const handlePrint = () => {
    const content = document.getElementById('client-print-analysis');
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Analysis - ${analysis?.original_filename}</title>
    <style>body{font-family:system-ui,sans-serif;padding:2rem;color:#1e293b;max-width:800px;margin:0 auto}
    h1{font-size:1.4rem;margin-bottom:0.25rem}h2{font-size:0.75rem;color:#64748b;margin:1.5rem 0 0.75rem;text-transform:uppercase;letter-spacing:0.05em}
    p{line-height:1.7;color:#475569;font-size:0.9rem}.flag{border-left:4px solid #dc2626;padding:0.75rem 1rem;margin-bottom:0.75rem;background:#fafafa;border-radius:0 6px 6px 0}
    .flag.medium{border-color:#d97706}.flag.low{border-color:#2563eb}.rec{display:flex;gap:0.75rem;margin-bottom:0.75rem}
    .num{background:#eff6ff;color:#1d4ed8;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0}
    table{width:100%;border-collapse:collapse}td{padding:0.5rem 0.75rem;border-bottom:1px solid #f1f5f9;font-size:0.85rem}td:last-child{text-align:right;font-weight:600}
    .disclaimer{font-size:0.78rem;color:#94a3b8;font-style:italic;border-top:1px solid #f1f5f9;padding-top:1rem;margin-top:1.5rem}
    @media print{body{padding:1rem}}</style></head><body>`);
    w.document.write(content.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  if (!analysis) return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '2rem', color: '#64748b', textAlign: 'center' }}>Loading analysis...</div>
      </div>
    </div>
  );

  const flags = analysis.anomaly_flags || [];
  const recs = analysis.cpa_recommendations || [];
  const figures = analysis.extracted_figures || {};

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>{analysis.original_filename}</div>
            <div style={styles.modalMeta}>{DOC_TYPE_LABELS[analysis.doc_type]} · {new Date(analysis.created_at).toLocaleDateString()}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.modalBody} id="client-print-analysis">
          {/* Confidence bar */}
          <div style={styles.confidenceBar}>
            <div>
              <div style={styles.confidenceLabel}>Analysis Confidence</div>
              <div style={styles.confidenceTrack}>
                <div style={{ ...styles.confidenceFill, width: `${Math.round((analysis.confidence_score || 0) * 100)}%` }} />
              </div>
            </div>
            <div style={styles.confidenceVal}>{Math.round((analysis.confidence_score || 0) * 100)}%</div>
          </div>

          {/* Summary */}
          <div style={styles.sectionTitle}>Summary</div>
          <p style={styles.summaryText}>{analysis.narrative_summary}</p>

          {/* Flags */}
          {flags.length > 0 && (
            <>
              <div style={styles.sectionTitle}>Items for Review ({flags.length})</div>
              {flags.map((f, i) => (
                <div key={i} style={{ ...styles.flag, borderLeft: `4px solid ${SEVERITY_COLORS[f.severity] || '#ccc'}` }} className={`flag ${f.severity}`}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ ...styles.severityBadge, background: SEVERITY_COLORS[f.severity] }}>{f.severity.toUpperCase()}</span>
                    <strong style={{ fontSize: '0.88rem' }}>{f.field}</strong>
                  </div>
                  <p style={styles.flagMsg}>{f.message}</p>
                </div>
              ))}
            </>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <>
              <div style={styles.sectionTitle}>Recommendations</div>
              {recs.map((r, i) => (
                <div key={i} style={styles.rec} className="rec">
                  <span style={styles.recNum} className="num">{i + 1}</span>
                  <p style={styles.recText}>{r}</p>
                </div>
              ))}
            </>
          )}

          {/* Figures */}
          {Object.keys(figures).length > 0 && (
            <>
              <div style={styles.sectionTitle}>Extracted Figures</div>
              <FiguresTable figures={figures} docType={analysis.doc_type} />
            </>
          )}

          <p style={styles.disclaimer} className="disclaimer">
            This analysis is generated by AI and should be reviewed by your CPA before filing.
          </p>
        </div>

        <div style={styles.modalFooter}>
          <button style={styles.printBtn} onClick={handlePrint}>Print / Save PDF</button>
          <button style={styles.closeModalBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function FiguresTable({ figures, docType }) {
  if (!figures || Object.keys(figures).length === 0) return null;

  if (docType === 'schedule_e') return (
    <div>
      {(figures.properties || []).map((p, i) => (
        <div key={i} style={styles.figureCard}>
          <div style={styles.figureAddress}>{p.address}</div>
          <div style={styles.figureRow}><span>Rental Income</span><span style={{ color: '#15803d', fontWeight: 600 }}>${p.rental_income?.toLocaleString()}</span></div>
          <div style={styles.figureRow}><span>Total Expenses</span><span style={{ color: '#dc2626', fontWeight: 600 }}>${p.total_expenses?.toLocaleString()}</span></div>
          <div style={{ ...styles.figureRow, borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', fontWeight: 600 }}><span>Net Income</span><span style={{ color: '#15803d' }}>${p.net_income?.toLocaleString()}</span></div>
        </div>
      ))}
      <FigureSummary rows={[['Total Rental Income', `$${figures.total_rental_income?.toLocaleString()}`], ['Total Expenses', `$${figures.total_expenses?.toLocaleString()}`], ['Net Income', `$${figures.total_net_income?.toLocaleString()}`], ['Depreciation', `$${figures.depreciation_claimed?.toLocaleString()}`], ['Mortgage Interest', `$${figures.mortgage_interest?.toLocaleString()}`]]} />
    </div>
  );

  if (docType === 'k1') return (
    <FigureSummary rows={[['Partnership', figures.partnership_name], ['Ownership %', `${figures.ownership_percentage}%`], ['Ordinary Income', `$${figures.ordinary_income?.toLocaleString()}`], ['Net Rental Income', `$${figures.net_rental_income?.toLocaleString()}`], ['Capital Gains', `$${figures.capital_gains_long_term?.toLocaleString()}`], ['Distributions', `$${figures.distributions?.toLocaleString()}`], ['Ending Capital', `$${figures.ending_capital?.toLocaleString()}`]]} />
  );

  if (docType === '1040') return (
    <FigureSummary rows={[['Filing Status', figures.filing_status], ['Tax Year', figures.tax_year], ['AGI', `$${figures.agi?.toLocaleString()}`], ['Taxable Income', `$${figures.taxable_income?.toLocaleString()}`], ['Total Tax', `$${figures.total_tax?.toLocaleString()}`], ['Effective Rate', figures.effective_tax_rate], [figures.refund_or_owed?.type === 'owed' ? 'Balance Due' : 'Refund', `$${figures.refund_or_owed?.amount?.toLocaleString()}`]]} />
  );

  if (docType === 'w2_1099') return (
    <div>
      {(figures.documents_detected || []).map((d, i) => (
        <div key={i} style={styles.figureCard}>
          <div style={styles.figureAddress}>{d.type} — {d.employer || d.payer}</div>
          {d.box1_wages && <div style={styles.figureRow}><span>Wages</span><span>${d.box1_wages?.toLocaleString()}</span></div>}
          {d.box2_federal_withheld && <div style={styles.figureRow}><span>Federal Withheld</span><span>${d.box2_federal_withheld?.toLocaleString()}</span></div>}
          {d.box1_interest && <div style={styles.figureRow}><span>Interest Income</span><span>${d.box1_interest?.toLocaleString()}</span></div>}
          {d.box1a_total_dividends && <div style={styles.figureRow}><span>Total Dividends</span><span>${d.box1a_total_dividends?.toLocaleString()}</span></div>}
        </div>
      ))}
    </div>
  );

  return null;
}

function FigureSummary({ rows }) {
  return (
    <div style={styles.figureSummary}>
      {rows.filter(([, v]) => v && v !== '$undefined').map(([label, val]) => (
        <div key={label} style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{label}</span>
          <span style={styles.summaryVal}>{val}</span>
        </div>
      ))}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' },
  header: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 },
  logo: { fontSize: '1.4rem', fontWeight: '700', letterSpacing: '-0.5px', color: '#0f1923' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
  userName: { fontSize: '0.9rem', color: '#64748b' },
  logoutBtn: { padding: '0.4rem 0.85rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', color: '#64748b' },
  content: { maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' },
  hero: { textAlign: 'center', padding: '2rem 0 2.5rem' },
  heroTitle: { fontSize: '2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' },
  heroSub: { color: '#64748b', fontSize: '1rem', marginBottom: '1.5rem' },
  uploadBtn: { display: 'inline-block', padding: '0.85rem 2.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' },
  uploadMsg: { color: '#15803d', marginTop: '1rem', fontWeight: '500' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' },
  statCard: { background: '#fff', padding: '1.25rem', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' },
  statVal: { fontSize: '2rem', fontWeight: '700', color: '#0f172a' },
  statLabel: { fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' },
  filterBar: { display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' },
  searchInput: { flex: 1, padding: '0.6rem 0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '0.88rem' },
  filterSelect: { padding: '0.6rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '0.88rem', background: '#fff' },
  clearBtn: { padding: '0.6rem 0.85rem', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569' },
  empty: { textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' },
  emptyIcon: { fontSize: '3.5rem', marginBottom: '1rem' },
  emptyTitle: { fontSize: '1.1rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' },
  emptySub: { fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2.5rem' },
  docCard: { background: '#fff', borderRadius: '12px', padding: '1.25rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1.5px solid transparent', transition: 'border-color 0.15s, box-shadow 0.15s' },
  docCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' },
  docTypeBadge: { padding: '3px 10px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%' },
  docFilename: { fontSize: '0.88rem', color: '#334155', fontWeight: '600', marginBottom: '0.3rem', wordBreak: 'break-all' },
  docDate: { fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem' },
  docFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  confidenceTag: { fontSize: '0.75rem', color: '#64748b' },
  flagRow: { display: 'flex', gap: '0.3rem' },
  flagPill: { padding: '2px 7px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '600' },
  timelineSection: { marginTop: '1rem' },
  timelineTitle: { fontWeight: '700', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '1rem' },
  timeline: { position: 'relative' },
  timelineItem: { display: 'flex', gap: '1rem', marginBottom: '1rem', position: 'relative', alignItems: 'flex-start' },
  timelineDot: { width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: '4px' },
  timelineLine: { position: 'absolute', left: '4px', top: '14px', width: '2px', height: 'calc(100% + 6px)', background: '#e2e8f0' },
  timelineContent: { flex: 1, paddingBottom: '0.5rem' },
  timelineFile: { fontSize: '0.88rem', fontWeight: '600', color: '#334155' },
  timelineMeta: { fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' },
  modal: { background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { fontWeight: '700', fontSize: '1rem', color: '#0f172a' },
  modalMeta: { fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' },
  modalBody: { padding: '1.5rem', overflow: 'auto', flex: 1 },
  modalFooter: { padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem' },
  confidenceBar: { display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem' },
  confidenceLabel: { fontSize: '0.78rem', color: '#64748b', marginBottom: '0.35rem' },
  confidenceTrack: { width: '200px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' },
  confidenceFill: { height: '100%', background: '#2563eb', borderRadius: '3px', transition: 'width 0.5s ease' },
  confidenceVal: { fontWeight: '700', fontSize: '1.1rem', color: '#15803d', marginLeft: 'auto' },
  sectionTitle: { fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.75rem', marginTop: '1.25rem' },
  summaryText: { fontSize: '0.9rem', color: '#334155', lineHeight: '1.7', margin: 0 },
  flag: { background: '#fafafa', padding: '0.85rem 1rem', borderRadius: '6px', marginBottom: '0.75rem' },
  severityBadge: { color: '#fff', padding: '1px 7px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: '700' },
  flagMsg: { fontSize: '0.87rem', color: '#475569', margin: '0.25rem 0 0', lineHeight: '1.6' },
  rec: { display: 'flex', gap: '0.75rem', marginBottom: '0.85rem', alignItems: 'flex-start' },
  recNum: { background: '#eff6ff', color: '#1d4ed8', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', flexShrink: 0, marginTop: '2px' },
  recText: { fontSize: '0.87rem', color: '#334155', margin: 0, lineHeight: '1.6' },
  disclaimer: { fontSize: '0.78rem', color: '#94a3b8', marginTop: '1.5rem', fontStyle: 'italic', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' },
  printBtn: { flex: 1, padding: '0.7rem', background: '#fff', color: '#0f1923', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' },
  closeModalBtn: { flex: 1, padding: '0.7rem', background: '#0f1923', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' },
  figureCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' },
  figureAddress: { fontWeight: '600', fontSize: '0.88rem', color: '#0f172a', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' },
  figureRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569', padding: '0.25rem 0' },
  figureSummary: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '0.6rem 1rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' },
  summaryLabel: { color: '#64748b' },
  summaryVal: { fontWeight: '600', color: '#334155' },
};