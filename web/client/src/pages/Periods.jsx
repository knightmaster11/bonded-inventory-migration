import { useState } from 'react';
import { useGet } from '../hooks.js';
import { api } from '../api.js';
import { Empty, ErrorBox, Loading, Page } from '../components.jsx';

export default function Periods() {
  const { data, error, loading, reload } = useGet('/periods');
  const [period, setPeriod] = useState('');
  const [actionError, setActionError] = useState(null);

  async function lock(e) {
    e.preventDefault();
    setActionError(null);
    try { await api.post(`/periods/${period}/lock`, { by: 'demo user' }); setPeriod(''); reload(); }
    catch (err) { setActionError(err); }
  }
  async function unlock(p) {
    if (!window.confirm(`Unlock ${p}? Only do this if the customs report for that month has not been filed.`)) return;
    setActionError(null);
    try { await api.del(`/periods/${p}/lock`); reload(); }
    catch (err) { setActionError(err); }
  }

  return (
    <Page title="Periods" subtitle="Lock a month after its report has been filed with customs. Locked months reject every kind of posting, not only incoming.">
      <ErrorBox error={error} />
      <ErrorBox error={actionError} onDismiss={() => setActionError(null)} />
      {loading && <Loading />}
      {data && data.length === 0 && <Empty>No locked periods.</Empty>}
      {data && data.length > 0 && (
        <table className="narrow">
          <thead><tr><th>Period</th><th>Locked at</th><th>By</th><th></th></tr></thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.period}>
                <td className="mono">{p.period}</td>
                <td className="muted">{String(p.locked_at).slice(0, 16)}</td>
                <td>{p.locked_by}</td>
                <td><button className="link" onClick={() => unlock(p.period)}>unlock</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2>Lock a period</h2>
      <form className="form inline" onSubmit={lock}>
        <label>Period (YYYY-MM)<input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-08" pattern="\d{4}-\d{2}" required /></label>
        <button className="btn primary">Lock</button>
      </form>
      <p className="muted">A period with draft documents cannot be locked; post or delete them first.</p>
    </Page>
  );
}
