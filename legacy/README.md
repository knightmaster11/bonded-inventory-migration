# Legacy side: VB6 + Access

This folder is the "before". It is a representative reconstruction of a bonded-zone inventory application of the kind used by garment and electronics manufacturers in Indonesian industrial estates in the 2010s: a VB6 executable on the warehouse PC, an Access `.mdb` on a shared drive, reports pushed into Excel by automation.

It is not a client's code. It was written for this case study so that the migration can be shown end to end without violating anyone's confidentiality. The patterns in it, including the bugs, are the ones that actually occur in systems like this.

| File | What it is |
|---|---|
| `modDB.bas` | Database connection, hard-coded company constants |
| `modInventory.bas` | The business logic: balances, numbering, period lock, posting for IN / OUT / OPNAME |
| `frmPengeluaran.frm` | The outgoing-goods form (BC 3.0 / BC 2.5 / BC 2.7) |
| `frmLaporanMutasi.frm` | The customs mutation report, written cell by cell into Excel |
| `Inventory.mdb.sql` | The Access schema, exported by hand |
| `docs/business-rules.md` | **Start here.** The rules the code enforces, the rules it only pretends to enforce, and what the rebuild does about each |

The `.frm` files are real VB6 form format and would load in the VB6 IDE; the `.frx` binary resources are omitted.
