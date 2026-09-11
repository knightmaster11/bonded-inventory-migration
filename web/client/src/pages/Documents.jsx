import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGet } from '../hooks.js';
import { DirectionPill, Empty, ErrorBox, Loading, Page, StatusPill } from '../components.jsx';

export default function Documents() {
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const qs = new URLSearchParams();
  if (direction) qs.set('direction', direction);
  if (status) qs.set('status', status);
  const { data, error, loading } = useGet(`/documents?${qs.toString()}`);

  return (
    <Page
      title="Documents"
      subtitle="Customs documents in, out, production and adjustments. Posted documents are immutable; corrections are new adjustments."
      actions={<Link className="btn primary" to="/documents/new">New document</Link>}
    >
      <div className="filters">
        <label>Direction
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="">All</option>
            <option value="IN">Incoming</option>
            <option value="OUT">Outgoing</option>
            <option value="PROD">Production</option>
            <option value="ADJ">Adjustment</option>
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
          </select>
        </label>
      </div>
      <ErrorBox error={error} />
      {loading && <Loading />}
      {data && data.length === 0 && <Empty>No documents match.</Empty>}
      {data && data.length > 0 && (
        <table>
          <thead><tr><th>Date</th><th>Document</th><th>Direction</th><th>BC type</th><th>Partner</th><th>Reference</th><th className="num">Lines</th><th>Status</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.id}>
                <td className="num">{d.doc_date}</td>
                <td><Link to={`/documents/${d.id}`}>{d.doc_no}</Link></td>
                <td><DirectionPill direction={d.direction} /></td>
                <td className="mono">{d.bc_type}</td>
                <td>{d.partner_name || <span className="muted">—</span>}</td>
                <td className="muted">{d.reference}</td>
                <td className="num">{d.line_count}</td>
                <td><StatusPill status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  );
}
