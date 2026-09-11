import { NavLink, Route, Routes } from 'react-router-dom';
import { useGet } from './hooks.js';
import Dashboard from './pages/Dashboard.jsx';
import Documents from './pages/Documents.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import NewDocument from './pages/NewDocument.jsx';
import Items from './pages/Items.jsx';
import Reports from './pages/Reports.jsx';
import Periods from './pages/Periods.jsx';

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/documents', label: 'Documents' },
  { to: '/items', label: 'Items' },
  { to: '/reports', label: 'Customs reports' },
  { to: '/periods', label: 'Periods' },
];

export default function App() {
  const meta = useGet('/meta');
  const health = useGet('/health');
  const company = meta.data ? meta.data.company : null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-eyebrow">Bonded zone inventory</div>
          <div className="brand-name">{company ? company.name : '…'}</div>
          {company && <div className="brand-sub">Licence {company.licence}</div>}
        </div>
        <nav>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="engine">{health.data ? `engine: ${health.data.engine}` : 'connecting…'}</span>
          <span className="muted">Rebuilt from VB6 + Access</span>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/new" element={<NewDocument />} />
          <Route path="/documents/:id" element={<DocumentDetail />} />
          <Route path="/items" element={<Items />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/periods" element={<Periods />} />
        </Routes>
      </main>
    </div>
  );
}
