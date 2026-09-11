import { Router } from 'express';
import { db } from './db.js';
import { badRequest, conflict, notFound } from './errors.js';
import { BC_TYPES, createDocument, deleteDraft, getDocument, listDocuments, postDocument } from './services/documents.js';
import { dashboard, movementReport, mutationReport, stockPosition, toCsv } from './services/reports.js';

export const api = Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const requirePeriod = (q) => {
  if (!isIsoDate(q.from) || !isIsoDate(q.to)) throw badRequest('from and to are required as YYYY-MM-DD');
  return { from: q.from, to: q.to };
};

api.get('/health', (req, res) => res.json({ ok: true, engine: process.env.DB_CLIENT === 'mysql2' ? 'mysql' : 'sqlite' }));
api.get('/meta', (req, res) => res.json({
  bc_types: BC_TYPES,
  company: { name: process.env.COMPANY_NAME || 'PT Contoh Garmen Indonesia', licence: process.env.COMPANY_LICENCE || '1234567890' },
}));

// ---- master data ----
api.get('/items', wrap(async (req, res) => {
  const q = db('items').orderBy('code');
  if (req.query.category) q.where('category', req.query.category);
  res.json(await q);
}));

api.post('/items', wrap(async (req, res) => {
  const { code, name, uom, category, hs_code } = req.body || {};
  if (!code || !name || !uom || !category) throw badRequest('code, name, uom and category are required');
  if (!['RAW', 'FG', 'AUX', 'MACHINE'].includes(category)) throw badRequest('category must be RAW, FG, AUX or MACHINE');
  const exists = await db('items').where({ code }).first();
  if (exists) throw conflict(`item ${code} already exists`);
  const [ins] = await db('items').insert({ code, name, uom, category, hs_code: hs_code || null }).returning('id');
  const id = typeof ins === 'object' ? ins.id : ins;
  res.status(201).json(await db('items').where({ id }).first());
}));

api.get('/partners', wrap(async (req, res) => res.json(await db('partners').orderBy('name'))));

// ---- documents ----
api.get('/documents', wrap(async (req, res) => res.json(await listDocuments(db, req.query))));
api.get('/documents/:id', wrap(async (req, res) => res.json(await getDocument(db, Number(req.params.id)))));
api.post('/documents', wrap(async (req, res) => res.status(201).json(await createDocument(db, req.body))));
api.post('/documents/:id/post', wrap(async (req, res) => res.json(await postDocument(db, Number(req.params.id)))));
api.delete('/documents/:id', wrap(async (req, res) => res.json(await deleteDraft(db, Number(req.params.id)))));

// ---- periods ----
api.get('/periods', wrap(async (req, res) => res.json(await db('period_locks').orderBy('period', 'desc'))));
api.post('/periods/:period/lock', wrap(async (req, res) => {
  const { period } = req.params;
  if (!/^\d{4}-\d{2}$/.test(period)) throw badRequest('period must be YYYY-MM');
  const exists = await db('period_locks').where({ period }).first();
  if (exists) throw conflict(`Period ${period} is already locked`);
  const drafts = await db('documents').count({ n: '*' }).where('status', 'DRAFT').where('doc_date', 'like', `${period}-%`).first();
  if (Number(drafts.n) > 0) throw conflict(`Period ${period} still has ${drafts.n} draft document(s)`);
  await db('period_locks').insert({ period, locked_by: (req.body && req.body.by) || 'demo' });
  res.status(201).json(await db('period_locks').where({ period }).first());
}));
api.delete('/periods/:period/lock', wrap(async (req, res) => {
  const n = await db('period_locks').where({ period: req.params.period }).del();
  if (!n) throw notFound('Period is not locked');
  res.json({ unlocked: req.params.period });
}));

// ---- reports ----
api.get('/dashboard', wrap(async (req, res) => res.json(await dashboard(db))));

api.get('/reports/stock-position', wrap(async (req, res) => {
  const rows = await stockPosition(db, { category: req.query.category });
  if (req.query.format === 'csv') return sendCsv(res, 'stock-position', rows, [
    { key: 'code', label: 'Item code' }, { key: 'name', label: 'Item name' }, { key: 'category', label: 'Category' },
    { key: 'uom', label: 'UoM' }, { key: 'qty_in', label: 'Total in' }, { key: 'qty_out', label: 'Total out' }, { key: 'balance', label: 'Balance' },
  ]);
  res.json(rows);
}));

api.get('/reports/mutation', wrap(async (req, res) => {
  const { from, to } = requirePeriod(req.query);
  const rows = await mutationReport(db, { from, to, category: req.query.category });
  if (req.query.format === 'csv') return sendCsv(res, `mutation-${from}-${to}`, rows, [
    { key: 'code', label: 'Item code' }, { key: 'name', label: 'Item name' }, { key: 'category', label: 'Category' }, { key: 'uom', label: 'UoM' },
    { key: 'opening', label: 'Opening' }, { key: 'qty_in', label: 'In' }, { key: 'produced', label: 'Produced' }, { key: 'consumed', label: 'Consumed' },
    { key: 'qty_out', label: 'Out' }, { key: 'adjustment', label: 'Adjustment' }, { key: 'closing', label: 'Closing' },
  ]);
  res.json(rows);
}));

api.get('/reports/movements', wrap(async (req, res) => {
  const { from, to } = requirePeriod(req.query);
  const direction = req.query.direction === 'OUT' ? 'OUT' : 'IN';
  const rows = await movementReport(db, { direction, from, to });
  if (req.query.format === 'csv') return sendCsv(res, `${direction.toLowerCase()}-${from}-${to}`, rows, [
    { key: 'doc_date', label: 'Date' }, { key: 'doc_no', label: 'Document' }, { key: 'bc_type', label: 'BC type' }, { key: 'reference', label: 'Reference' },
    { key: 'partner_name', label: 'Partner' }, { key: 'partner_country', label: 'Country' }, { key: 'item_code', label: 'Item code' }, { key: 'item_name', label: 'Item name' },
    { key: 'qty', label: 'Qty' }, { key: 'uom', label: 'UoM' }, { key: 'unit_value', label: 'Unit value' }, { key: 'currency', label: 'Currency' }, { key: 'line_value', label: 'Line value' },
  ]);
  res.json(rows);
}));

function sendCsv(res, name, rows, columns) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  res.send(toCsv(rows, columns));
}
