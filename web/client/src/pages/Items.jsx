import { useState } from 'react';
import { useGet } from '../hooks.js';
import { api, CATEGORY_LABEL, fmt } from '../api.js';
import { ErrorBox, Loading, Page } from '../components.jsx';

export default function Items() {
  const { data, error, loading, reload } = useGet('/reports/stock-position');
  const [form, setForm] = useState({ code: '', name: '', uom: 'PCS', category: 'RAW', hs_code: '' });
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setFormError(null);
    try {
      await api.post('/items', form);
      setForm({ code: '', name: '', uom: 'PCS', category: 'RAW', hs_code: '' });
      reload();
    } catch (err) { setFormError(err); }
    finally { setBusy(false); }
  }

  return (
    <Page title="Items" subtitle="Master data with the current derived balance of each item.">
      <ErrorBox error={error} />
      {loading && <Loading />}
      {data && (
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>HS code</th><th className="num">Total in</th><th className="num">Total out</th><th className="num">Balance</th><th>UoM</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.code}</td>
                <td>{r.name}</td>
                <td>{CATEGORY_LABEL[r.category]}</td>
                <td className="mono muted">{r.hs_code}</td>
                <td className="num">{fmt(r.qty_in)}</td>
                <td className="num">{fmt(r.qty_out)}</td>
                <td className={`num ${r.balance < 0 ? 'neg' : ''}`}><strong>{fmt(r.balance)}</strong></td>
                <td>{r.uom}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Add item</h2>
      <ErrorBox error={formError} onDismiss={() => setFormError(null)} />
      <form className="form inline" onSubmit={submit}>
        <label>Code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></label>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>UoM<input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value.toUpperCase() })} required /></label>
        <label>Category
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>HS code<input value={form.hs_code} onChange={(e) => setForm({ ...form, hs_code: e.target.value })} /></label>
        <button className="btn primary" disabled={busy}>Add</button>
      </form>
    </Page>
  );
}
