import { Link } from 'react-router-dom';
import { useGet } from '../hooks.js';
import { CATEGORY_LABEL, fmt } from '../api.js';
import { DirectionPill, ErrorBox, Loading, Page, StatusPill } from '../components.jsx';

export default function Dashboard() {
  const { data, error, loading } = useGet('/dashboard');

  return (
    <Page
      title="Dashboard"
      subtitle="Every balance on this screen is derived from the movement ledger. There is no stock table to drift."
      actions={<Link className="btn primary" to="/documents/new">New document</Link>}
    >
      <ErrorBox error={error} />
      {loading && <Loading />}
      {data && (
        <>
          <div className="tiles">
            {['RAW', 'FG', 'AUX', 'MACHINE'].map((cat) => {
              const c = data.by_category[cat] || { items: 0, balance: 0, negative: 0 };
              return (
                <div className="tile" key={cat}>
                  <div className="tile-label">{CATEGORY_LABEL[cat]}</div>
                  <div className="tile-value">{fmt(c.balance, 0)}</div>
                  <div className="tile-sub">{c.items} item{c.items === 1 ? '' : 's'}{c.negative ? ` · ${c.negative} negative` : ''}</div>
                </div>
              );
            })}
            <div className="tile tile-accent">
              <div className="tile-label">Draft documents</div>
              <div className="tile-value">{data.draft_count}</div>
              <div className="tile-sub">{data.locked_periods.length ? `Locked: ${data.locked_periods.join(', ')}` : 'No locked periods'}</div>
            </div>
          </div>

          <div className="two-col">
            <section>
              <h2>Recent documents</h2>
              <table>
                <thead><tr><th>Date</th><th>Document</th><th>Type</th><th>Partner</th><th>Status</th></tr></thead>
                <tbody>
                  {data.recent_documents.map((d) => (
                    <tr key={d.id}>
                      <td className="num">{d.doc_date}</td>
                      <td><Link to={`/documents/${d.id}`}>{d.doc_no}</Link></td>
                      <td><DirectionPill direction={d.direction} /></td>
                      <td>{d.partner_name || <span className="muted">—</span>}</td>
                      <td><StatusPill status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              <h2>Raw materials running low</h2>
              {data.low_stock.length === 0
                ? <p className="muted">Nothing at or below 50 units.</p>
                : (
                  <table>
                    <thead><tr><th>Item</th><th className="num">Balance</th></tr></thead>
                    <tbody>
                      {data.low_stock.map((r) => (
                        <tr key={r.id}><td>{r.code} {r.name}</td><td className="num">{fmt(r.balance)} {r.uom}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              <h2>What changed from the VB6 version</h2>
              <ul className="notes">
                <li>Posting is one transaction per document. A failed line means nothing was written.</li>
                <li>Period locks apply to incoming, outgoing, production and adjustments alike.</li>
                <li>Ledger dates are document dates, never "today".</li>
                <li>Production is its own document, not a stock-take adjustment.</li>
                <li>The mutation report is one query, not four per item.</li>
              </ul>
            </section>
          </div>
        </>
      )}
    </Page>
  );
}
