const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText);
    err.status = res.status;
    err.details = data && data.details;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  del: (path) => request(path, { method: 'DELETE' }),
  csv: (path) => BASE + path + (path.includes('?') ? '&' : '?') + 'format=csv',
};

export const fmt = (n, digits = 2) =>
  n === null || n === undefined ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });

export const DIRECTION_LABEL = { IN: 'Incoming', OUT: 'Outgoing', PROD: 'Production', ADJ: 'Adjustment' };
export const CATEGORY_LABEL = { RAW: 'Raw material', FG: 'Finished goods', AUX: 'Auxiliary', MACHINE: 'Machinery' };

export function firstOfMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
