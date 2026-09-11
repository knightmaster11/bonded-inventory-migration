// Ported from modInventory.bas. Every rule from legacy/docs/business-rules.md
// is referenced by its number (R1..R7 kept, F1..F9 fixed).

import { badRequest, conflict, notFound, unprocessable } from '../errors.js';

export const BC_TYPES = {
  IN: {
    BC23: 'Import into bonded zone',
    BC40: 'Local goods into bonded zone',
    BC27: 'Transfer from another bonded zone',
  },
  OUT: {
    BC30: 'Export',
    BC25: 'Release to local market (duty paid)',
    BC27: 'Transfer to another bonded zone',
  },
  PROD: {
    PRODUKSI: 'Production report (materials consumed, goods produced)',
  },
  ADJ: {
    OPNAME: 'Stock-take adjustment',
  },
};

const needsPartner = (direction) => direction === 'IN' || direction === 'OUT';

const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// R1: {BC}/{YYYY}/{MM}/{NNNN}, sequence per type per month.
// Runs inside the posting/creation transaction so two clerks cannot
// share a number (F5).
export async function nextDocNo(trx, bcType, docDate) {
  const [y, m] = docDate.split('-');
  const prefix = `${bcType}/${y}/${m}/`;
  const row = await trx('documents')
    .where('doc_no', 'like', `${prefix}%`)
    .max({ max: 'doc_no' })
    .first();
  const seq = row && row.max ? Number(String(row.max).slice(-4)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// Derived balance. No balance table, by design (section A).
export async function balanceOf(trx, itemId, { before } = {}) {
  const q = trx('stock_ledger').where({ item_id: itemId });
  if (before) q.andWhere('entry_date', '<', before);
  const row = await q.sum({ qin: 'qty_in' }).sum({ qout: 'qty_out' }).first();
  return num(row.qin) - num(row.qout);
}

// R4, applied to every direction (F2).
export async function assertPeriodOpen(trx, docDate) {
  const period = docDate.slice(0, 7);
  const lock = await trx('period_locks').where({ period }).first();
  if (lock) throw conflict(`Period ${period} is locked`, { period, locked_at: lock.locked_at });
}

export async function getDocument(db, id) {
  const doc = await db('documents as d')
    .leftJoin('partners as p', 'p.id', 'd.partner_id')
    .select('d.*', 'p.code as partner_code', 'p.name as partner_name', 'p.country as partner_country')
    .where('d.id', id)
    .first();
  if (!doc) throw notFound(`Document ${id} not found`);
  const lines = await db('document_lines as l')
    .join('items as i', 'i.id', 'l.item_id')
    .select('l.*', 'i.code as item_code', 'i.name as item_name', 'i.category as item_category')
    .where('l.document_id', id)
    .orderBy('l.id');
  return { ...doc, lines };
}

export async function listDocuments(db, { direction, status, from, to, limit = 100 } = {}) {
  const q = db('documents as d')
    .leftJoin('partners as p', 'p.id', 'd.partner_id')
    .select('d.*', 'p.code as partner_code', 'p.name as partner_name')
    .select(db('document_lines').count('*').whereRaw('document_lines.document_id = d.id').as('line_count'))
    .orderBy([{ column: 'd.doc_date', order: 'desc' }, { column: 'd.id', order: 'desc' }])
    .limit(Math.min(Number(limit) || 100, 500));
  if (direction) q.where('d.direction', direction);
  if (status) q.where('d.status', status);
  if (from) q.where('d.doc_date', '>=', from);
  if (to) q.where('d.doc_date', '<=', to);
  return q;
}

// Creates a DRAFT with lines. Validation that the VB6 forms did in
// scattered places (F9: zero-qty lines; R5: BC25 customs value) is here.
export async function createDocument(db, payload) {
  const { direction, bc_type, doc_date, partner_id, reference, notes, lines } = payload || {};

  if (!BC_TYPES[direction]) throw badRequest('direction must be IN, OUT, PROD or ADJ');
  if (!BC_TYPES[direction][bc_type]) {
    throw badRequest(`bc_type ${bc_type} is not valid for direction ${direction}`, {
      allowed: Object.keys(BC_TYPES[direction]),
    });
  }
  if (!isIsoDate(doc_date)) throw badRequest('doc_date must be YYYY-MM-DD');
  if (!Array.isArray(lines) || lines.length === 0) throw badRequest('at least one line is required');
  if (needsPartner(direction) && !partner_id) throw badRequest('partner_id is required for IN and OUT documents');

  return db.transaction(async (trx) => {
    await assertPeriodOpen(trx, doc_date);

    if (partner_id) {
      const partner = await trx('partners').where({ id: partner_id }).first();
      if (!partner) throw badRequest(`partner ${partner_id} not found`);
    }

    const itemIds = [...new Set(lines.map((l) => Number(l.item_id)))];
    const items = await trx('items').whereIn('id', itemIds);
    const itemById = new Map(items.map((i) => [i.id, i]));

    const problems = [];
    const cleanLines = lines.map((l, idx) => {
      const item = itemById.get(Number(l.item_id));
      const qty = num(l.qty);
      if (!item) problems.push({ line: idx + 1, error: `item ${l.item_id} not found` });
      if (qty === 0) problems.push({ line: idx + 1, error: 'quantity must not be zero' });
      if (needsPartner(direction) && qty < 0) problems.push({ line: idx + 1, error: 'quantity must be positive' });
      if (direction === 'PROD' && item) {
        // Production: negative lines are materials consumed, positive lines are goods produced.
        if (qty > 0 && item.category !== 'FG') problems.push({ line: idx + 1, error: 'produced items must be finished goods (FG)' });
        if (qty < 0 && !['RAW', 'AUX'].includes(item.category)) problems.push({ line: idx + 1, error: 'consumed items must be raw (RAW) or auxiliary (AUX) materials' });
      }
      if (bc_type === 'BC25' && num(l.unit_value) <= 0) {
        problems.push({ line: idx + 1, error: 'BC 2.5 requires a customs value per unit' });
      }
      return {
        item_id: item ? item.id : null,
        qty,
        uom: l.uom || (item ? item.uom : null),
        unit_value: l.unit_value === undefined || l.unit_value === null ? null : num(l.unit_value),
        currency: l.currency || (l.unit_value ? 'USD' : null),
      };
    });
    if (problems.length) throw unprocessable('Document has invalid lines', { problems });

    const doc_no = await nextDocNo(trx, bc_type, doc_date);
    const [inserted] = await trx('documents')
      .insert({ doc_no, direction, bc_type, doc_date, partner_id: partner_id || null, reference: reference || null, notes: notes || null })
      .returning('id');
    const id = typeof inserted === 'object' ? inserted.id : inserted;

    await trx('document_lines').insert(cleanLines.map((l) => ({ ...l, document_id: id })));
    return getDocument(trx, id);
  });
}

// Posting. One transaction per document: all lines or none (F1).
// Period lock (R4/F2), document date on the ledger (F3), stock guard (R2),
// customs value guard (R5/F4) all apply on the same path for IN, OUT, ADJ.
export async function postDocument(db, id) {
  return db.transaction(async (trx) => {
    const doc = await trx('documents').where({ id }).first();
    if (!doc) throw notFound(`Document ${id} not found`);
    if (doc.status === 'POSTED') throw conflict(`Document ${doc.doc_no} is already posted`);

    await assertPeriodOpen(trx, doc.doc_date);

    const lines = await trx('document_lines as l')
      .join('items as i', 'i.id', 'l.item_id')
      .select('l.*', 'i.code as item_code', 'i.name as item_name')
      .where('l.document_id', id);
    if (lines.length === 0) throw unprocessable('Document has no lines');

    // R2: every line that takes stock out is checked before anything is written.
    const consuming = doc.direction === 'OUT' ? lines
      : doc.direction === 'PROD' ? lines.filter((l) => num(l.qty) < 0)
      : [];
    if (consuming.length) {
      const shortages = [];
      for (const line of consuming) {
        const balance = await balanceOf(trx, line.item_id);
        const requested = Math.abs(num(line.qty));
        if (balance < requested) {
          shortages.push({ item_code: line.item_code, item_name: line.item_name, balance, requested });
        }
      }
      if (shortages.length) {
        throw unprocessable('Insufficient stock; nothing was posted', { shortages });
      }
    }
    if (doc.direction === 'OUT' && doc.bc_type === 'BC25' && lines.some((l) => num(l.unit_value) <= 0)) {
      throw unprocessable('BC 2.5 requires a customs value on every line; nothing was posted');
    }

    const entries = lines.map((line) => {
      const qty = num(line.qty);
      if (doc.direction === 'IN') return { kind: 'IN', qty_in: qty, qty_out: 0 };
      if (doc.direction === 'OUT') return { kind: 'OUT', qty_in: 0, qty_out: qty };
      const kind = doc.direction === 'PROD' ? 'PROD' : 'ADJ';
      return qty >= 0 ? { kind, qty_in: qty, qty_out: 0 } : { kind, qty_in: 0, qty_out: Math.abs(qty) };
    }).map((e, i) => ({
      ...e,
      item_id: lines[i].item_id,
      document_id: id,
      entry_date: doc.doc_date,
      memo: `${doc.bc_type} ${doc.doc_no}`,
    }));

    await trx('stock_ledger').insert(entries);
    await trx('documents').where({ id }).update({ status: 'POSTED', posted_at: trx.fn.now() });
    return getDocument(trx, id);
  });
}

export async function deleteDraft(db, id) {
  const doc = await db('documents').where({ id }).first();
  if (!doc) throw notFound(`Document ${id} not found`);
  if (doc.status === 'POSTED') throw conflict('Posted documents cannot be deleted (R3). Use a stock-take adjustment.');
  await db('documents').where({ id }).del();
  return { deleted: id };
}
