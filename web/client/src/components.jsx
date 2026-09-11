import { DIRECTION_LABEL } from './api.js';

export function Page({ title, subtitle, actions, children }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Pill({ kind, children }) {
  return <span className={`pill pill-${kind}`}>{children}</span>;
}

export function StatusPill({ status }) {
  return <Pill kind={status === 'POSTED' ? 'good' : 'draft'}>{status}</Pill>;
}

export function DirectionPill({ direction }) {
  return <Pill kind={direction.toLowerCase()}>{DIRECTION_LABEL[direction] || direction}</Pill>;
}

export function ErrorBox({ error, onDismiss }) {
  if (!error) return null;
  const details = error.details;
  return (
    <div className="error-box" role="alert">
      <div className="error-head">
        <strong>{error.message}</strong>
        {onDismiss && <button className="link" onClick={onDismiss}>Dismiss</button>}
      </div>
      {details && details.shortages && (
        <table className="mini">
          <thead><tr><th>Item</th><th className="num">Balance</th><th className="num">Requested</th><th className="num">Short by</th></tr></thead>
          <tbody>
            {details.shortages.map((s) => (
              <tr key={s.item_code}>
                <td>{s.item_code} {s.item_name}</td>
                <td className="num">{s.balance}</td>
                <td className="num">{s.requested}</td>
                <td className="num neg">{s.requested - s.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {details && details.problems && (
        <ul className="problem-list">
          {details.problems.map((p, i) => <li key={i}>Line {p.line}: {p.error}</li>)}
        </ul>
      )}
      {details && details.period && <p className="muted">Locked at {details.locked_at}</p>}
    </div>
  );
}

export function Loading() {
  return <p className="muted">Loading…</p>;
}

export function Empty({ children = 'Nothing here yet.' }) {
  return <p className="muted empty">{children}</p>;
}
