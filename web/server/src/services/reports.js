// The four IT-inventory reports customs asks for, as set-based queries.
// The VB6 version ran 4 SUM queries per item and wrote cell by cell into
// Excel (F8). These run in one round trip each.

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

// Laporan Posisi Barang: current derived balance per item.
export async function stockPosition(db, { category } = {}) {
  const q = db('items as i')
    .leftJoin('stock_ledger as s', 's.item_id', 'i.id')
    .select('i.id', 'i.code', 'i.name', 'i.uom', 'i.category', 'i.hs_code')
    .sum({ qty_in: 's.qty_in' })
    .sum({ qty_out: 's.qty_out' })
    .max({ last_movement: 's.entry_date' })
    .where('i.active', true)
    .groupBy('i.id', 'i.code', 'i.name', 'i.uom', 'i.category', 'i.hs_code')
    .orderBy('i.code');
  if (category) q.where('i.category', category);
  const rows = await q;
  return rows.map((r) => ({
    ...r,
    qty_in: num(r.qty_in),
    qty_out: num(r.qty_out),
    balance: num(r.qty_in) - num(r.qty_out),
  }));
}

// Laporan Pertanggungjawaban Mutasi (R7):
// opening | in | out | adjustment | closing, per item, for a period.
export async function mutationReport(db, { from, to, category }) {
  const items = db('items as i').select('i.id', 'i.code', 'i.name', 'i.uom', 'i.category').where('i.active', true);
  if (category) items.where('i.category', category);
  const itemRows = await items.orderBy('i.code');

  const opening = db('stock_ledger')
    .select('item_id')
    .sum({ qin: 'qty_in' }).sum({ qout: 'qty_out' })
    .where('entry_date', '<', from)
    .groupBy('item_id');

  const inPeriod = db('stock_ledger')
    .select('item_id', 'kind')
    .sum({ qin: 'qty_in' }).sum({ qout: 'qty_out' })
    .whereBetween('entry_date', [from, to])
    .groupBy('item_id', 'kind');

  const [openRows, periodRows] = await Promise.all([opening, inPeriod]);
  const openBy = new Map(openRows.map((r) => [r.item_id, num(r.qin) - num(r.qout)]));
  const blank = () => ({ in: 0, out: 0, produced: 0, consumed: 0, adj: 0 });
  const period = new Map();
  for (const r of periodRows) {
    const cur = period.get(r.item_id) || blank();
    if (r.kind === 'IN') cur.in += num(r.qin);
    else if (r.kind === 'OUT') cur.out += num(r.qout);
    else if (r.kind === 'PROD') { cur.produced += num(r.qin); cur.consumed += num(r.qout); }
    else cur.adj += num(r.qin) - num(r.qout);
    period.set(r.item_id, cur);
  }

  // Raw-material report: opening | in | consumed | out | adj | closing
  // Finished-goods report: opening | produced | out | adj | closing
  // Both come from the same rows; the client shows the relevant columns.
  return itemRows.map((i) => {
    const o = openBy.get(i.id) || 0;
    const p = period.get(i.id) || blank();
    return {
      ...i,
      opening: o,
      qty_in: p.in,
      produced: p.produced,
      consumed: p.consumed,
      qty_out: p.out,
      adjustment: p.adj,
      closing: o + p.in + p.produced - p.consumed - p.out + p.adj,
    };
  });
}

// Laporan Pemasukan / Pengeluaran Barang: posted document lines in a period.
export async function movementReport(db, { direction, from, to }) {
  return db('document_lines as l')
    .join('documents as d', 'd.id', 'l.document_id')
    .join('items as i', 'i.id', 'l.item_id')
    .leftJoin('partners as p', 'p.id', 'd.partner_id')
    .select(
      'd.doc_no', 'd.bc_type', 'd.doc_date', 'd.reference',
      'p.name as partner_name', 'p.country as partner_country',
      'i.code as item_code', 'i.name as item_name', 'i.category',
      'l.qty', 'l.uom', 'l.unit_value', 'l.currency',
    )
    .where('d.direction', direction)
    .where('d.status', 'POSTED')
    .whereBetween('d.doc_date', [from, to])
    .orderBy(['d.doc_date', 'd.doc_no', 'l.id'])
    .then((rows) => rows.map((r) => ({
      ...r,
      qty: num(r.qty),
      unit_value: r.unit_value === null ? null : num(r.unit_value),
      line_value: r.unit_value === null ? null : num(r.qty) * num(r.unit_value),
    })));
}

export async function dashboard(db) {
  const [position, recent, drafts, locks] = await Promise.all([
    stockPosition(db),
    db('documents as d').leftJoin('partners as p', 'p.id', 'd.partner_id')
      .select('d.id', 'd.doc_no', 'd.direction', 'd.bc_type', 'd.doc_date', 'd.status', 'p.name as partner_name')
      .orderBy([{ column: 'd.doc_date', order: 'desc' }, { column: 'd.id', order: 'desc' }]).limit(8),
    db('documents').count({ n: '*' }).where('status', 'DRAFT').first(),
    db('period_locks').orderBy('period', 'desc'),
  ]);
  const byCategory = {};
  for (const r of position) {
    byCategory[r.category] = byCategory[r.category] || { items: 0, balance: 0, negative: 0 };
    byCategory[r.category].items += 1;
    byCategory[r.category].balance += r.balance;
    if (r.balance < 0) byCategory[r.category].negative += 1;
  }
  return {
    by_category: byCategory,
    draft_count: num(drafts.n),
    recent_documents: recent,
    locked_periods: locks.map((l) => l.period),
    low_stock: position.filter((r) => r.category === 'RAW' && r.balance <= 50).slice(0, 5),
  };
}

export function toCsv(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(',')).join('\n');
  return `${head}\n${body}\n`;
}
