import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGet } from '../hooks.js';
import { api, today } from '../api.js';
import { ErrorBox, Loading, Page } from '../components.jsx';

const emptyLine = () => ({ item_id: '', qty: '', unit_value: '', currency: 'USD' });

export default function NewDocument() {
  const navigate = useNavigate();
  const meta = useGet('/meta');
  const items = useGet('/items');
  const partners = useGet('/partners');

  const [direction, setDirection] = useState('IN');
  const [bcType, setBcType] = useState('BC23');
  const [docDate, setDocDate] = useState(today());
  const [partnerId, setPartnerId] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const bcTypes = meta.data ? meta.data.bc_types[direction] : {};
  const itemById = useMemo(() => new Map((items.data || []).map((i) => [String(i.id), i])), [items.data]);

  const partnerOptions = useMemo(() => {
    const all = partners.data || [];
    if (direction === 'IN') return bcType === 'BC27' ? all.filter((p) => p.type === 'BONDED_ZONE') : all.filter((p) => ['SUPPLIER', 'BOTH'].includes(p.type));
    if (direction === 'OUT') return bcType === 'BC27' ? all.filter((p) => p.type === 'BONDED_ZONE') : all.filter((p) => ['BUYER', 'BOTH'].includes(p.type));
    return [];
  }, [partners.data, direction, bcType]);

  function changeDirection(d) {
    setDirection(d);
    const first = meta.data ? Object.keys(meta.data.bc_types[d])[0] : '';
    setBcType(first);
    setPartnerId('');
  }

  function setLine(i, patch) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const payload = {
        direction, bc_type: bcType, doc_date: docDate,
        partner_id: partnerId ? Number(partnerId) : null,
        reference: reference || null, notes: notes || null,
        lines: lines.filter((l) => l.item_id && l.qty !== '').map((l) => ({
          item_id: Number(l.item_id),
          qty: Number(l.qty),
          uom: itemById.get(l.item_id) ? itemById.get(l.item_id).uom : null,
          unit_value: l.unit_value === '' ? null : Number(l.unit_value),
          currency: l.unit_value === '' ? null : l.currency,
        })),
      };
      const doc = await api.post('/documents', payload);
      navigate(`/documents/${doc.id}`);
    } catch (err) { setError(err); setBusy(false); }
  }

  const needsPartner = direction === 'IN' || direction === 'OUT';
  const showValue = direction === 'IN' || direction === 'OUT';
  const qtyHint = direction === 'PROD' ? 'Negative = consumed material, positive = finished goods produced'
    : direction === 'ADJ' ? 'Positive or negative difference found at stock-take' : '';

  return (
    <Page title="New document" subtitle="Saved as a draft. Nothing touches the ledger until you post it.">
      <ErrorBox error={error} onDismiss={() => setError(null)} />
      {(meta.loading || items.loading || partners.loading) && <Loading />}
      {meta.data && items.data && partners.data && (
        <form className="form" onSubmit={submit}>
          <div className="grid-4">
            <label>Direction
              <select value={direction} onChange={(e) => changeDirection(e.target.value)}>
                <option value="IN">Incoming</option>
                <option value="OUT">Outgoing</option>
                <option value="PROD">Production</option>
                <option value="ADJ">Adjustment</option>
              </select>
            </label>
            <label>Document type
              <select value={bcType} onChange={(e) => { setBcType(e.target.value); setPartnerId(''); }}>
                {Object.entries(bcTypes).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
              </select>
            </label>
            <label>Date
              <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} required />
            </label>
            {needsPartner && (
              <label>Partner
                <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
                  <option value="">Select…</option>
                  {partnerOptions.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.country})</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="grid-2">
            <label>Reference <span className="muted">(AJU / PEB / invoice / batch)</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} />
            </label>
            <label>Notes
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>

          <h2>Lines {qtyHint && <span className="muted hint">{qtyHint}</span>}</h2>
          <table className="lines">
            <thead>
              <tr><th>Item</th><th className="num">Quantity</th><th>UoM</th>{showValue && <th className="num">Unit value</th>}{showValue && <th>Currency</th>}<th></th></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const item = itemById.get(l.item_id);
                return (
                  <tr key={i}>
                    <td>
                      <select value={l.item_id} onChange={(e) => setLine(i, { item_id: e.target.value })}>
                        <option value="">Select item…</option>
                        {items.data.map((it) => <option key={it.id} value={it.id}>{it.code} · {it.name} ({it.category})</option>)}
                      </select>
                    </td>
                    <td><input className="num" type="number" step="any" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                    <td className="mono">{item ? item.uom : ''}</td>
                    {showValue && <td><input className="num" type="number" step="any" min="0" value={l.unit_value} onChange={(e) => setLine(i, { unit_value: e.target.value })} placeholder={bcType === 'BC25' ? 'required' : ''} /></td>}
                    {showValue && (
                      <td>
                        <select value={l.currency} onChange={(e) => setLine(i, { currency: e.target.value })}>
                          <option>USD</option><option>IDR</option><option>JPY</option><option>EUR</option>
                        </select>
                      </td>
                    )}
                    <td><button type="button" className="link" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>remove</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="actions-row">
            <button type="button" className="btn" onClick={() => setLines((ls) => [...ls, emptyLine()])}>Add line</button>
            <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>
          </div>
        </form>
      )}
    </Page>
  );
}
