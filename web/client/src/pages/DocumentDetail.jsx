import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGet } from '../hooks.js';
import { api, fmt } from '../api.js';
import { DirectionPill, ErrorBox, Loading, Page, StatusPill } from '../components.jsx';

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: doc, error, loading, reload } = useGet(`/documents/${id}`);
  const meta = useGet('/meta');
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const typeLabel = doc && meta.data ? (meta.data.bc_types[doc.direction] || {})[doc.bc_type] : '';

  async function post() {
    if (!window.confirm(`Post ${doc.doc_no}? Posted documents cannot be changed.`)) return;
    setBusy(true); setActionError(null);
    try { await api.post(`/documents/${id}/post`); reload(); }
    catch (e) { setActionError(e); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm(`Delete draft ${doc.doc_no}?`)) return;
    setBusy(true); setActionError(null);
    try { await api.del(`/documents/${id}`); navigate('/documents'); }
    catch (e) { setActionError(e); setBusy(false); }
  }

  const totalValue = doc ? doc.lines.reduce((s, l) => s + (l.unit_value ? Number(l.qty) * Number(l.unit_value) : 0), 0) : 0;
  const currency = doc && doc.lines.find((l) => l.currency) ? doc.lines.find((l) => l.currency).currency : '';

  return (
    <Page
      title={doc ? doc.doc_no : 'Document'}
      subtitle={doc ? `${typeLabel || doc.bc_type} · ${doc.doc_date}` : ''}
      actions={doc && doc.status === 'DRAFT' && (
        <>
          <button className="btn" onClick={remove} disabled={busy}>Delete draft</button>
          <button className="btn primary" onClick={post} disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
        </>
      )}
    >
      <ErrorBox error={error} />
      <ErrorBox error={actionError} onDismiss={() => setActionError(null)} />
      {loading && <Loading />}
      {doc && (
        <>
          <dl className="facts">
            <div><dt>Direction</dt><dd><DirectionPill direction={doc.direction} /></dd></div>
            <div><dt>Status</dt><dd><StatusPill status={doc.status} />{doc.posted_at && <span className="muted"> · posted {String(doc.posted_at).slice(0, 16)}</span>}</dd></div>
            <div><dt>Partner</dt><dd>{doc.partner_name ? `${doc.partner_name} (${doc.partner_country})` : <span className="muted">—</span>}</dd></div>
            <div><dt>Reference</dt><dd>{doc.reference || <span className="muted">—</span>}</dd></div>
            {doc.notes && <div><dt>Notes</dt><dd>{doc.notes}</dd></div>}
          </dl>

          <table>
            <thead>
              <tr>
                <th>#</th><th>Item</th><th>Category</th>
                <th className="num">{doc.direction === 'PROD' ? 'Consumed (−) / Produced (+)' : doc.direction === 'ADJ' ? 'Adjustment' : 'Quantity'}</th>
                <th>UoM</th><th className="num">Unit value</th><th className="num">Line value</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={l.id}>
                  <td className="num muted">{i + 1}</td>
                  <td>{l.item_code} <span className="muted">{l.item_name}</span></td>
                  <td className="mono">{l.item_category}</td>
                  <td className={`num ${Number(l.qty) < 0 ? 'neg' : ''}`}>{fmt(l.qty, 4)}</td>
                  <td>{l.uom}</td>
                  <td className="num">{l.unit_value ? `${fmt(l.unit_value)} ${l.currency || ''}` : ''}</td>
                  <td className="num">{l.unit_value ? fmt(Number(l.qty) * Number(l.unit_value)) : ''}</td>
                </tr>
              ))}
            </tbody>
            {totalValue > 0 && (
              <tfoot><tr><td colSpan="6" className="num">Total customs value</td><td className="num"><strong>{fmt(totalValue)} {currency}</strong></td></tr></tfoot>
            )}
          </table>

          <p className="muted"><Link to="/documents">← All documents</Link></p>
        </>
      )}
    </Page>
  );
}
