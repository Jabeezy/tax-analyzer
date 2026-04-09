import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'client' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let user;
      if (mode === 'login') {
        user = await login(form.email, form.password);
      } else {
        user = await register(form);
      }
      navigate(user.role === 'cpa' ? '/cpa' : '/client');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>TAX<span style={styles.logoAccent}>AI</span></div>
          <p style={styles.tagline}>Secure Tax Document Analyzer</p>
        </div>

        <div style={styles.tabs}>
          <button style={mode === 'login' ? styles.tabActive : styles.tab} onClick={() => setMode('login')}>Sign In</button>
          <button style={mode === 'register' ? styles.tabActive : styles.tab} onClick={() => setMode('register')}>Register</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <>
              <input style={styles.input} placeholder="Full Name" value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })} required />
              <select style={styles.input} value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="client">Client</option>
                <option value="cpa">CPA Staff</option>
              </select>
            </>
          )}
          <input style={styles.input} type="email" placeholder="Email address" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} required />
          <input style={styles.input} type="password" placeholder="Password" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} required />

          {error && <div style={styles.error}>{error}</div>}

          <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p style={styles.secureNote}>🔒 All documents are encrypted in transit and at rest</p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1923', padding: '1rem' },
  card: { background: '#fff', borderRadius: '12px', padding: '2.5rem', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  header: { textAlign: 'center', marginBottom: '2rem' },
  logo: { fontSize: '2rem', fontWeight: '700', color: '#0f1923', letterSpacing: '-1px' },
  logoAccent: { color: '#2563eb' },
  tagline: { color: '#6b7280', fontSize: '0.85rem', marginTop: '0.25rem' },
  tabs: { display: 'flex', marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb' },
  tab: { flex: 1, padding: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.95rem' },
  tabActive: { flex: 1, padding: '0.75rem', background: 'none', border: 'none', borderBottom: '2px solid #2563eb', cursor: 'pointer', color: '#2563eb', fontWeight: '600', fontSize: '0.95rem', marginBottom: '-2px' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: { padding: '0.75rem 1rem', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  btn: { padding: '0.85rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', marginTop: '0.5rem' },
  error: { background: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' },
  secureNote: { textAlign: 'center', color: '#9ca3af', fontSize: '0.78rem', marginTop: '1.5rem' }
};