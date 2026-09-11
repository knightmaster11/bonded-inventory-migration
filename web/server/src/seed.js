// Demo data for a garment manufacturer in a bonded zone, June to September 2026.
// Documents are created and posted through the same service the API uses,
// so the ledger is produced by the real rules, not inserted by hand.

import { createDocument, postDocument } from './services/documents.js';

const ITEMS = [
  { code: 'FAB-001', name: 'Cotton twill fabric 280 gsm', uom: 'MTR', category: 'RAW', hs_code: '5209.42' },
  { code: 'FAB-002', name: 'Polyester lining 60 gsm', uom: 'MTR', category: 'RAW', hs_code: '5407.61' },
  { code: 'INT-001', name: 'Fusible interlining', uom: 'MTR', category: 'RAW', hs_code: '5903.90' },
  { code: 'THR-001', name: 'Sewing thread 40/2', uom: 'CONE', category: 'RAW', hs_code: '5401.10' },
  { code: 'ZIP-001', name: 'Metal zipper 60 cm', uom: 'PCS', category: 'RAW', hs_code: '9607.11' },
  { code: 'BTN-001', name: 'Shank button 20 mm', uom: 'PCS', category: 'RAW', hs_code: '9606.22' },
  { code: 'LBL-001', name: 'Woven main label', uom: 'PCS', category: 'RAW', hs_code: '5807.10' },
  { code: 'PKG-001', name: 'Polybag 40 x 60 cm', uom: 'PCS', category: 'AUX', hs_code: '3923.21' },
  { code: 'PKG-002', name: 'Export carton 60 x 40 x 40 cm', uom: 'PCS', category: 'AUX', hs_code: '4819.10' },
  { code: 'JKT-001', name: "Men's twill work jacket", uom: 'PCS', category: 'FG', hs_code: '6203.32' },
  { code: 'TRS-001', name: "Men's twill work trousers", uom: 'PCS', category: 'FG', hs_code: '6203.42' },
  { code: 'MCH-001', name: 'Industrial lockstitch sewing machine', uom: 'UNIT', category: 'MACHINE', hs_code: '8452.21' },
];

const PARTNERS = [
  { code: 'SUP-JP-01', name: 'Nishikawa Textile Co., Ltd.', country: 'JP', type: 'SUPPLIER' },
  { code: 'SUP-KR-01', name: 'Daehan Trims Co., Ltd.', country: 'KR', type: 'SUPPLIER' },
  { code: 'SUP-ID-01', name: 'PT Benang Nusantara', country: 'ID', type: 'SUPPLIER' },
  { code: 'BUY-DE-01', name: 'Northline Workwear GmbH', country: 'DE', type: 'BUYER' },
  { code: 'BUY-US-01', name: 'Ridgeway Supply Inc.', country: 'US', type: 'BUYER' },
  { code: 'BUY-ID-01', name: 'PT Seragam Karya Lokal', country: 'ID', type: 'BUYER' },
  { code: 'KB-ID-01', name: 'PT Mitra Garmen Cikarang (bonded zone)', country: 'ID', type: 'BONDED_ZONE' },
];

// [direction, bc_type, date, partner code, reference, lines[[item, qty, unit_value, currency]], options]
const DOCS = [
  ['IN', 'BC23', '2026-06-03', 'SUP-JP-01', 'AJU 000123-2026', [['FAB-001', 6000, 3.20, 'USD'], ['FAB-002', 3000, 1.10, 'USD'], ['INT-001', 1500, 0.85, 'USD']]],
  ['IN', 'BC23', '2026-06-05', 'SUP-KR-01', 'AJU 000131-2026', [['ZIP-001', 4000, 0.35, 'USD'], ['BTN-001', 12000, 0.04, 'USD'], ['LBL-001', 5000, 0.02, 'USD']]],
  ['IN', 'BC40', '2026-06-08', 'SUP-ID-01', 'INV BN-2026-0611', [['THR-001', 600, 21000, 'IDR'], ['PKG-001', 5000, 350, 'IDR'], ['PKG-002', 800, 6500, 'IDR']]],
  ['IN', 'BC23', '2026-06-10', 'SUP-JP-01', 'AJU 000140-2026', [['MCH-001', 4, 1850, 'USD']]],
  ['PROD', 'PRODUKSI', '2026-06-20', null, 'Batch JKT-2606', [
    ['FAB-001', -1800], ['FAB-002', -900], ['INT-001', -450], ['THR-001', -60], ['ZIP-001', -1200], ['BTN-001', -3600], ['LBL-001', -1200], ['PKG-001', -1200], ['PKG-002', -100],
    ['JKT-001', 1150],
  ]],
  ['OUT', 'BC30', '2026-06-27', 'BUY-DE-01', 'PEB 001877 / INV EX-2606-01', [['JKT-001', 1000, 18.50, 'USD']]],
  ['ADJ', 'OPNAME', '2026-06-30', null, 'BA Opname 30-06-2026', [['FAB-001', -12], ['BTN-001', 40]]],
  { lock: '2026-06' },

  ['IN', 'BC23', '2026-07-07', 'SUP-JP-01', 'AJU 000212-2026', [['FAB-001', 5000, 3.25, 'USD']]],
  ['PROD', 'PRODUKSI', '2026-07-14', null, 'Batch JKT/TRS-2607', [
    ['FAB-001', -2400], ['FAB-002', -600], ['INT-001', -300], ['THR-001', -80], ['ZIP-001', -800], ['BTN-001', -2400], ['LBL-001', -1600], ['PKG-001', -1600], ['PKG-002', -140],
    ['JKT-001', 700], ['TRS-001', 850],
  ]],
  ['OUT', 'BC30', '2026-07-22', 'BUY-US-01', 'PEB 002034 / INV EX-2607-01', [['JKT-001', 800, 18.50, 'USD'], ['TRS-001', 600, 14.20, 'USD']]],
  ['OUT', 'BC25', '2026-07-28', 'BUY-ID-01', 'INV LOK-2607-03', [['JKT-001', 50, 19.00, 'USD']]],
  ['OUT', 'BC27', '2026-07-31', 'KB-ID-01', 'BC27 transfer 0088', [['FAB-002', 400, 1.10, 'USD']]],
  { lock: '2026-07' },

  ['IN', 'BC40', '2026-08-04', 'SUP-ID-01', 'INV BN-2026-0803', [['THR-001', 400, 21500, 'IDR'], ['PKG-001', 4000, 360, 'IDR']]],
  ['IN', 'BC23', '2026-08-11', 'SUP-KR-01', 'AJU 000305-2026', [['ZIP-001', 3000, 0.35, 'USD'], ['BTN-001', 9000, 0.04, 'USD'], ['LBL-001', 6000, 0.02, 'USD']]],
  ['PROD', 'PRODUKSI', '2026-08-18', null, 'Batch JKT/TRS-2608', [
    ['FAB-001', -2000], ['FAB-002', -500], ['INT-001', -250], ['THR-001', -70], ['ZIP-001', -700], ['BTN-001', -2100], ['LBL-001', -1400], ['PKG-001', -1400], ['PKG-002', -120],
    ['JKT-001', 650], ['TRS-001', 700],
  ]],
  ['OUT', 'BC30', '2026-08-26', 'BUY-DE-01', 'PEB 002310 / INV EX-2608-01', [['TRS-001', 900, 14.20, 'USD'], ['JKT-001', 400, 18.50, 'USD']]],

  ['IN', 'BC23', '2026-09-02', 'SUP-JP-01', 'AJU 000388-2026', [['FAB-001', 4000, 3.30, 'USD'], ['FAB-002', 2000, 1.12, 'USD']]],
  ['PROD', 'PRODUKSI', '2026-09-08', null, 'Batch JKT/TRS-2609', [
    ['FAB-001', -1500], ['FAB-002', -400], ['INT-001', -200], ['THR-001', -50], ['ZIP-001', -500], ['BTN-001', -1500], ['LBL-001', -1000], ['PKG-001', -1000], ['PKG-002', -90],
    ['JKT-001', 480], ['TRS-001', 500],
  ]],
  // Two drafts left open: one that will post, one that will fail the stock guard.
  ['OUT', 'BC30', '2026-09-10', 'BUY-US-01', 'INV EX-2609-01 (draft)', [['JKT-001', 500, 18.75, 'USD']], { draft: true }],
  ['OUT', 'BC30', '2026-09-12', 'BUY-DE-01', 'INV EX-2609-02 (draft)', [['TRS-001', 800, 14.20, 'USD']], { draft: true }],
];

export async function seedIfEmpty(db) {
  const existing = await db('items').count({ n: '*' }).first();
  if (Number(existing.n) > 0) return false;

  await db('items').insert(ITEMS);
  await db('partners').insert(PARTNERS);

  const items = await db('items');
  const partners = await db('partners');
  const itemId = Object.fromEntries(items.map((i) => [i.code, i.id]));
  const itemUom = Object.fromEntries(items.map((i) => [i.code, i.uom]));
  const partnerId = Object.fromEntries(partners.map((p) => [p.code, p.id]));

  for (const entry of DOCS) {
    if (!Array.isArray(entry)) {
      await db('period_locks').insert({ period: entry.lock, locked_by: 'seed' });
      continue;
    }
    const [direction, bc_type, doc_date, partnerCode, reference, lines, options = {}] = entry;
    const doc = await createDocument(db, {
      direction,
      bc_type,
      doc_date,
      partner_id: partnerCode ? partnerId[partnerCode] : null,
      reference,
      lines: lines.map(([code, qty, unit_value, currency]) => ({
        item_id: itemId[code],
        qty,
        uom: itemUom[code],
        unit_value: unit_value ?? null,
        currency: currency ?? null,
      })),
    });
    if (!options.draft) await postDocument(db, doc.id);
  }
  return true;
}
