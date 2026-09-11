# From VB6 to web: a bonded-warehouse inventory migration

A case study in reading a legacy business system and rebuilding it without losing the rules buried inside it.

The **before** is a VB6 + Access application of the kind that runs inventory for garment and electronics manufacturers in Indonesian bonded zones (Kawasan Berikat), where customs requires an auditable record of every unit of material that enters, is consumed, is produced, and leaves. The **after** is the same system as a React + Express web application, on SQLite for the demo and MySQL for production, with every rule from the old code either kept, fixed, or made real.

```
npm run install:all
npm run dev
# API   http://localhost:3001/api
# App   http://localhost:5173
```

The demo database is created and seeded on first start with four months of a garment factory's documents. `npm run reset` wipes it.

---

## What the legacy system did, and what it got wrong

The old application has one good idea and a dozen quiet problems. The good idea: **there is no stock balance table**. Every balance is derived from the movement ledger, so any report handed to customs can be regenerated from source records. The rebuild keeps this.

The problems are the reason companies pay for migrations. They are documented in full in [`legacy/docs/business-rules.md`](legacy/docs/business-rules.md); the ones that matter most:

| # | In the VB6 code | Effect on the business | In the rebuild |
|---|---|---|---|
| F1 | Outgoing documents post line by line, no transaction. On the first line with insufficient stock the loop exits; earlier lines stay posted. | Re-posting duplicates them. This is the source of the unexplained differences in the annual customs mutation report. | One transaction per document. All lines or none. |
| F2 | Period lock is checked on incoming documents only. | Outgoing and adjustments land in months already reported to customs. | One posting path for every direction; the lock applies to all. |
| F3 | Outgoing ledger entries are dated *today*, not the document date. | An export dated the 30th, posted on the 2nd, is counted in the wrong month. | Ledger date is always the document date. |
| F4 | BC 2.5 customs-value check is a message box, not a block. | Duty-bearing releases posted with no value. | Rejected at creation and again at posting. |
| F5 | Document numbers have no unique index. | Two clerks, one number. | Unique index; number assigned inside the transaction. |
| F8 | Balance recomputed with a full `SUM` per line per posting; the mutation report runs four aggregate queries per item and writes cell by cell into Excel. | Six minutes for the monthly report on the warehouse PC. | Set-based queries; the report is two `GROUP BY`s and a CSV. |
| F12 | There is no production document. Finished goods are booked as stock-take adjustments with negative lines for materials consumed. | The mutation report shows large "adjustments" every month; material usage has to be reconstructed by hand for customs. | A real production document: negative lines consume, positive lines produce, same stock guard as outgoing. |

Reading the old code to find these is the actual work of a migration. The rewrite is the easy part.

---

## What is in this repository

```
legacy/                       the "before"
  modInventory.bas            business logic: balances, numbering, period lock, posting
  modDB.bas                   Access connection, hard-coded company constants
  frmPengeluaran.frm          outgoing-goods form
  frmLaporanMutasi.frm        customs mutation report via Excel automation
  Inventory.mdb.sql           Access schema
  docs/business-rules.md      extracted rules and findings (start here)

web/server/                   the "after", API
  src/schema.js               tables, created on first run
  src/services/documents.js   the ported rules, each one referenced by number
  src/services/reports.js     the four customs reports as set-based queries
  src/routes.js               HTTP surface
  src/seed.js                 four months of demo documents, posted through the real rules

web/client/                   the "after", UI
  src/pages/                  dashboard, documents, new document, items, customs reports, periods
```

**Stack.** Express 4, Knex 3 (better-sqlite3 by default, mysql2 with `DB_CLIENT=mysql2`), React 18, Vite 5, React Router 6. No UI framework; about 300 lines of CSS. The point of the demo is the domain logic, not the toolkit.

---

## The domain in one screen

A bonded-zone company imports materials duty-free, manufactures, and exports. Customs allows this only if the company can show where every unit went. The system tracks four kinds of movement:

| Direction | Document types | Ledger effect |
|---|---|---|
| Incoming | BC 2.3 import · BC 4.0 from local market · BC 2.7 from another bonded zone | + |
| Outgoing | BC 3.0 export · BC 2.5 release to local market (duty paid, customs value required) · BC 2.7 to another bonded zone | − |
| Production | PRODUKSI | − materials (RAW, AUX), + finished goods (FG) |
| Adjustment | OPNAME stock-take | ± |

And produces the four reports customs asks for: **incoming goods**, **outgoing goods**, **stock position**, and the **mutation report** (Laporan Pertanggungjawaban Mutasi) per period, separately for raw materials (opening · in · consumed · out · adjustment · closing) and finished goods (opening · produced · out · adjustment · closing).

Rules that hold on every path, in [`services/documents.js`](web/server/src/services/documents.js):

- **R1** Document number `{BC}/{YYYY}/{MM}/{NNNN}`, sequence per type per month, assigned inside the transaction.
- **R2** Stock cannot go negative. Every line that takes stock out (outgoing, or the consumed side of production) is checked before anything is written; the error names every short item with its balance.
- **R3** Posted documents are immutable. Corrections are new adjustment documents.
- **R4** A locked period rejects postings of every direction. A period with drafts cannot be locked.
- **R5** BC 2.5 lines require a customs value per unit.
- **R7** The mutation report reconciles: closing = opening + in + produced − consumed − out + adjustment.

---

## Try the rules

The seed leaves two drafts open. In the app, open **Documents → Draft**:

- `BC30/2026/09/0001` posts cleanly.
- `BC30/2026/09/0002` asks for 800 trousers against a balance of 550. Post it and read the error: it names the item, the balance, and the shortfall, and nothing was written.

Then try to create an adjustment dated in July 2026. The period is locked; the API says so before a draft is even saved.

Or from the shell:

```
curl http://localhost:3001/api/reports/mutation?from=2026-08-01&to=2026-08-31&category=RAW
curl "http://localhost:3001/api/reports/mutation?from=2026-08-01&to=2026-08-31&category=FG&format=csv"
```

---

## Running on MySQL

```
cd web/server
copy .env.example .env
# set DB_CLIENT=mysql2 and the connection details; create the database first
npm run dev
```

Same code, same schema builder, same seed. This is usually the first question a migration client asks, so the demo answers it.

---

## Screenshots

_To be added after the first run: dashboard, the failed post with the shortage table, the finished-goods mutation report._

---

## About this code

The legacy side is a representative reconstruction written for this case study, not a client's system; the patterns in it, including the defects, are the ones that actually occur in VB6 and Access applications of this kind. The web side is the migration I would build for one.

Iwan Setiono · Cikarang, Indonesia · [LinkedIn](https://www.linkedin.com/in/iwan-setiono-971645213/)
