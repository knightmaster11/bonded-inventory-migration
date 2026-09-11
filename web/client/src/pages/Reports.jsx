import { useSearchParams } from 'react-router-dom';
import { useGet } from '../hooks.js';
import { api, CATEGORY_LABEL, firstOfMonth, fmt, today } from '../api.js';
import { ErrorBox, Loading, Page } from '../components.jsx';

const TABS = [
  { key: 'mutation', label: 'Mutation (pertanggungjawaban)' },
  { key: 'position', label: 'Stock position' },
  { key: 'in', label: 'Incoming goods' },
  { key: 'out', label: 'Outgoing goods' },
];

// Report state lives in the URL so a specific report can be bookmarked or
// sent to a customs officer as a link: /reports?tab=mutation&category=FG&from=…&to=…
export default function Reports() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'mutation';
  const from = params.get('from') || firstOfMonth();
  const to = params.get('to') || today();
  const category = params.has('category') ? params.get('category') : 'RAW';

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined) next.delete(k); else next.set(k, v);
    }
    setParams(next, { replace: true });
  };
  const switchTab = (key) => update({ tab: key, ...(key !== 'position' && category === '' ? { category: 'RAW' } : {}) });

  return (
    <Page title="Customs reports" subtitle="The four reports an IT-inventory system must produce for Bea Cukai. Each is one query; each exports to CSV.">
      <div className="tabs">
        {TABS.map((t) => <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => switchTab(t.key)}>{t.label}</button>)}
      </div>
      <div className="filters">
        {tab !== 'position' && (
          <>
            <label>From<input type="date" value={from} onChange={(e) => update({ from: e.target.value })} /></label>
            <label>To<input type="date" value={to} onChange={(e) => update({ to: e.target.value })} /></label>
          </>
        )}
        {(tab === 'mutation' || tab === 'position') && (
          <label>Category
            <select value={category} onChange={(e) => update({ category: e.target.value })}>
              {tab === 'position' && <option value="">All</option>}
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        )}
      </div>
      {tab === 'mutation' && <Mutation from={from} to={to} category={category} />}
      {tab === 'position' && <Position category={category} />}
      {(tab === 'in' || tab === 'out') && <Movements direction={tab === 'in' ? 'IN' : 'OUT'} from={from} to={to} />}
    </Page>
  );
}

function Mutation({ from, to, category }) {
  const path = `/reports/mutation?from=${from}&to=${to}&category=${category}`;
  const { data, error, loading } = useGet(path);
  const isFg = category === 'FG';
  const sum = (k) => (data || []).reduce((s, r) => s + Number(r[k] || 0), 0);
  return (
    <>
      <div className="report-head">
        <h2>{isFg ? 'Finished goods' : CATEGORY_LABEL[category]} · {from} to {to}</h2>
        <a className="btn" href={api.csv(path)}>Download CSV</a>
      </div>
      <ErrorBox error={error} />
      {loading && <Loading />}
      {data && (
        <table>
          <thead>
            <tr>
              <th>Code</th><th>Item</th><th>UoM</th>
              <th className="num">Opening</th>
              {!isFg && <th className="num">In</th>}
              {isFg ? <th className="num">Produced</th> : <th className="num">Consumed</th>}
              <th className="num">Out</th>
              <th className="num">Adjustment</th>
              <th className="num">Closing</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.code}</td><td>{r.name}</td><td>{r.uom}</td>
                <td className="num">{fmt(r.opening)}</td>
                {!isFg && <td className="num">{fmt(r.qty_in)}</td>}
                {isFg ? <td className="num">{fmt(r.produced)}</td> : <td className="num">{fmt(r.consumed)}</td>}
                <td className="num">{fmt(r.qty_out)}</td>
                <td className={`num ${r.adjustment < 0 ? 'neg' : ''}`}>{fmt(r.adjustment)}</td>
                <td className={`num ${r.closing < 0 ? 'neg' : ''}`}><strong>{fmt(r.closing)}</strong></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3">Total</td>
              <td className="num">{fmt(sum('opening'))}</td>
              {!isFg && <td className="num">{fmt(sum('qty_in'))}</td>}
              <td className="num">{fmt(sum(isFg ? 'produced' : 'consumed'))}</td>
              <td className="num">{fmt(sum('qty_out'))}</td>
              <td className="num">{fmt(sum('adjustment'))}</td>
              <td className="num">{fmt(sum('closing'))}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </>
  );
}

function Position({ category }) {
  const path = `/reports/stock-position${category ? `?category=${category}` : ''}`;
  const { data, error, loading } = useGet(path);
  return (
    <>
      <div className="report-head">
        <h2>Stock position as of now</h2>
        <a className="btn" href={api.csv(path)}>Download CSV</a>
      </div>
      <ErrorBox error={error} />
      {loading && <Loading />}
      {data && (
        <table>
          <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>UoM</th><th className="num">Total in</th><th className="num">Total out</th><th className="num">Balance</th><th>Last movement</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.code}</td><td>{r.name}</td><td>{CATEGORY_LABEL[r.category]}</td><td>{r.uom}</td>
                <td className="num">{fmt(r.qty_in)}</td><td className="num">{fmt(r.qty_out)}</td>
                <td className={`num ${r.balance < 0 ? 'neg' : ''}`}><strong>{fmt(r.balance)}</strong></td>
                <td className="num muted">{r.last_movement || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function Movements({ direction, from, to }) {
  const path = `/reports/movements?direction=${direction}&from=${from}&to=${to}`;
  const { data, error, loading } = useGet(path);
  return (
    <>
      <div className="report-head">
        <h2>{direction === 'IN' ? 'Incoming' : 'Outgoing'} goods · {from} to {to}</h2>
        <a className="btn" href={api.csv(path)}>Download CSV</a>
      </div>
      <ErrorBox error={error} />
      {loading && <Loading />}
      {data && data.length === 0 && <p className="muted">No posted lines in this period.</p>}
      {data && data.length > 0 && (
        <table>
          <thead><tr><th>Date</th><th>Document</th><th>BC</th><th>Partner</th><th>Item</th><th className="num">Qty</th><th>UoM</th><th className="num">Unit value</th><th className="num">Line value</th></tr></thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i}>
                <td className="num">{r.doc_date}</td><td className="mono">{r.doc_no}</td><td className="mono">{r.bc_type}</td>
                <td>{r.partner_name} <span className="muted">({r.partner_country})</span></td>
                <td>{r.item_code} <span className="muted">{r.item_name}</span></td>
                <td className="num">{fmt(r.qty)}</td><td>{r.uom}</td>
                <td className="num">{r.unit_value !== null ? `${fmt(r.unit_value)} ${r.currency}` : ''}</td>
                <td className="num">{r.line_value !== null ? fmt(r.line_value) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
