# Legacy system: extracted business rules

**System:** Inventory Kawasan Berikat, VB6 + Access 2003 (Jet 4.0), DAO 3.6
**Purpose:** the IT-inventory system Indonesian customs (Bea Cukai) requires a bonded-zone company to keep, so that every movement of goods in and out of the zone can be audited against customs documents.
**Read from:** `modInventory.bas`, `modDB.bas`, `frmPengeluaran.frm`, `frmLaporanMutasi.frm`, `Inventory.mdb.sql`

This is the kind of document a modernization assessment produces: what the old system *actually* does, as opposed to what people remember it doing. Rules are numbered so the web rebuild can reference them.

---

## A. What the system is for

A company operating in a bonded zone (Kawasan Berikat) imports raw materials without paying duty, manufactures, and exports. Customs allows this only if the company can prove, at any time, where every unit of material went. The system's single job is to make that proof reconstructible.

Consequence, stated in the code header of `modInventory.bas`: **there is no stock balance table.** Every balance is derived from the movement ledger (`TblMutasi`). The original author did this deliberately so that any report handed to customs can be regenerated from source records. The rebuild keeps this.

## B. Document types

| Direction | Code | Meaning | Partner |
|---|---|---|---|
| IN | BC 2.3 | Import from abroad into the bonded zone | foreign supplier |
| IN | BC 4.0 | Goods from the domestic market (TLDDP) into the zone | local supplier |
| IN | BC 2.7 | Transfer in from another bonded zone | other KB |
| OUT | BC 3.0 | Export | foreign buyer |
| OUT | BC 2.5 | Release to the domestic market; import duty and VAT become payable | local buyer |
| OUT | BC 2.7 | Transfer out to another bonded zone | other KB |
| ADJ | OPNAME | Stock-take adjustment (positive or negative) | none |

There is no production document. See F12.

## C. Rules the code enforces

**R1. Document numbering.** `{BC}/{YYYY}/{MM}/{NNNN}`, sequence restarts per document type per month, derived from `MAX(NoDokumen)` matching the prefix. (`NomorDokumenBaru`)

**R2. Stock may not go negative on an outgoing document.** Each line is checked against the current derived balance before it is posted. (`PostingPengeluaran`)

**R3. Posted documents are immutable.** There is no cancel or unpost. Corrections are made with an OPNAME adjustment document, which writes a positive or negative ledger entry. Customs auditors asked for this so that the audit trail never has gaps. (`PostingOpname`, confirmed by form logic: `cmdPosting` warns "cannot be changed")

**R4. Periods are locked after the monthly customs report is filed.** A locked month rejects new postings. (`PeriodeTerkunci`, `TblPeriode`)

**R5. BC 2.5 lines must carry a customs value per unit** (`NilaiSatuan`), because duty and VAT are assessed on it.

**R6. Ledger entries are typed by the `Keterangan` text** (`Pemasukan` / `Pengeluaran` / `Opname`). The mutation report groups on this text.

**R7. The customs mutation report** (Laporan Pertanggungjawaban Mutasi) per item for a period is:
`opening = net movements before period` · `in` · `out` · `adjustment` · `closing = opening + in − out + adj`, produced separately for raw materials and finished goods.

## D. Rules the code *intends* but does not enforce

These are the findings. Each one has produced a real discrepancy that someone had to explain to a customs officer.

**F1. Outgoing posting is not atomic.** `PostingPengeluaran` inserts ledger rows line by line inside a loop and exits on the first line with insufficient stock. Lines already written stay written; the document stays DRAFT. The user re-posts, and the earlier lines are duplicated. *This is the primary source of the unexplained differences in the annual mutation report.*

**F2. Period lock is only checked on incoming documents.** `PeriodeTerkunci` is called from the incoming form, never from `frmPengeluaran` or `PostingOpname`. Outgoing and adjustment postings can land in a month that has already been reported.

**F3. Outgoing ledger entries use today's date, not the document date.** `PostingPengeluaran` writes `TglSQL(Date)`; `PostingPemasukan` correctly writes the document date. An export dated the 30th, posted on the 2nd, is counted in the wrong month.

**F4. The BC 2.5 customs-value check is a message box, not a block.** Missing values are reported and then posted anyway.

**F5. Document numbers are not unique.** No unique index on `TblDokumen.NoDokumen`; two clerks saving in the same second get the same number. Fixed by hand in Access when noticed.

**F6. Dates are parsed with `CDate` under Windows regional settings.** `03/09/2026` is 3 September on one PC and 9 March on another. It happened on the shipping department's PC.

**F7. Every string goes into SQL by concatenation.** An item code containing an apostrophe breaks the statement. (This is also SQL injection, but in a single-user Access app the practical effect was crashes, not attacks.)

**F8. Balance is recomputed with a full `SUM` per line, per posting, per report cell.** The mutation report runs four aggregate queries per item and writes cell by cell through Excel automation: around 250 items, 1,000 queries, 2,000 cell writes, six minutes on the warehouse PC.

**F9. Empty grid rows are saved as zero-quantity lines** and appear in reports.

**F10. Company name and customs licence number are constants in `modDB.bas`.** A second company means a second compiled executable.

**F11. `TblStokLama` still exists**, holding 2009 to 2012 balances from the pre-VB6 spreadsheet, with dates stored as `dd/mm/yyyy` text. Nothing reads it; nobody dares delete it.

**F12. Production is recorded as stock-take adjustments.** The system has no production document. When a batch of jackets is finished, the warehouse posts an OPNAME with negative lines for the fabric and trims consumed and a positive line for the jackets produced. The customs mutation report therefore shows large "adjustments" every month, and the raw-material usage that customs actually wants to see (Laporan Pemakaian Bahan Baku) has to be reconstructed by hand from those adjustments. This is the question the customs officer asks first at every audit.

## E. Decisions for the rebuild

| Legacy | Rebuild | Why |
|---|---|---|
| Derived balances, no balance table (A) | Keep | It is the right design for an audit-driven system |
| R1 to R7 | Keep, enforce in one service | Rules move out of forms into `services/posting.js` so every entry point applies them |
| F1 partial posting | One database transaction per document; all lines or none | Removes the largest source of reconciliation errors |
| F2, F3 | Period lock and document date applied uniformly to IN, OUT, ADJ | Same code path for all three directions |
| F4 | BC 2.5 without customs value is rejected, not warned | The rule exists; make it real |
| F5 | Unique index on document number; numbering inside the transaction | Two clerks, one number, never |
| F6 | Dates are ISO `YYYY-MM-DD` end to end | No regional parsing anywhere |
| F7 | Parameterised queries via a query builder | Apostrophes and injection both gone |
| F8 | Balances and reports are set-based queries (`GROUP BY`) | Milliseconds instead of minutes |
| F9 | Lines validated server-side; zero quantity rejected | |
| F10 | Company details in configuration | One build, many companies |
| F11 | Not migrated; archived as a read-only export | Nobody reads it; keep the file, drop the table |
| F12 | A real production document (`PROD`): negative lines consume RAW/AUX, positive lines produce FG, same stock guard as outgoing | Adjustments go back to meaning adjustments; material usage and output become reportable columns |
| Access file on a shared drive | SQLite for the demo, MySQL or PostgreSQL for production, same code | The query builder abstracts the engine |
| Excel automation for reports | JSON API plus CSV export | Works without Excel installed; can feed the customs portal directly |
