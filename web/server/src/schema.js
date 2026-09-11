// Creates the schema if it does not exist. Kept as plain schema-builder
// calls (no migration runner) so the demo starts with one command on
// either engine.

export async function ensureSchema(db) {
  if (!(await db.schema.hasTable('items'))) {
    await db.schema.createTable('items', (t) => {
      t.increments('id');
      t.string('code', 30).notNullable().unique();
      t.string('name', 120).notNullable();
      t.string('uom', 10).notNullable();
      t.enu('category', ['RAW', 'FG', 'AUX', 'MACHINE']).notNullable();
      t.string('hs_code', 12);
      t.boolean('active').notNullable().defaultTo(true);
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  if (!(await db.schema.hasTable('partners'))) {
    await db.schema.createTable('partners', (t) => {
      t.increments('id');
      t.string('code', 20).notNullable().unique();
      t.string('name', 120).notNullable();
      t.string('country', 2).notNullable(); // ID = domestic market (TLDDP)
      t.enu('type', ['SUPPLIER', 'BUYER', 'BOTH', 'BONDED_ZONE']).notNullable();
    });
  }

  if (!(await db.schema.hasTable('documents'))) {
    await db.schema.createTable('documents', (t) => {
      t.increments('id');
      t.string('doc_no', 40).notNullable().unique(); // F5: unique, unlike TblDokumen
      t.enu('direction', ['IN', 'OUT', 'PROD', 'ADJ']).notNullable();
      t.string('bc_type', 10).notNullable();
      t.string('doc_date', 10).notNullable(); // ISO YYYY-MM-DD, F6
      t.integer('partner_id').unsigned().references('id').inTable('partners');
      t.string('reference', 60);
      t.enu('status', ['DRAFT', 'POSTED']).notNullable().defaultTo('DRAFT');
      t.timestamp('posted_at');
      t.text('notes');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.index(['direction', 'doc_date']);
    });
  }

  if (!(await db.schema.hasTable('document_lines'))) {
    await db.schema.createTable('document_lines', (t) => {
      t.increments('id');
      t.integer('document_id').unsigned().notNullable()
        .references('id').inTable('documents').onDelete('CASCADE');
      t.integer('item_id').unsigned().notNullable().references('id').inTable('items');
      t.decimal('qty', 18, 4).notNullable(); // negative allowed only for ADJ
      t.string('uom', 10).notNullable();
      t.decimal('unit_value', 18, 2); // customs value per unit, required for BC25 (R5)
      t.string('currency', 3);
      t.index(['document_id']);
    });
  }

  if (!(await db.schema.hasTable('stock_ledger'))) {
    await db.schema.createTable('stock_ledger', (t) => {
      t.increments('id');
      t.integer('item_id').unsigned().notNullable().references('id').inTable('items');
      t.integer('document_id').unsigned().references('id').inTable('documents');
      t.enu('kind', ['IN', 'OUT', 'PROD', 'ADJ']).notNullable(); // R6, typed instead of free text
      t.string('entry_date', 10).notNullable(); // always the document date, F3
      t.decimal('qty_in', 18, 4).notNullable().defaultTo(0);
      t.decimal('qty_out', 18, 4).notNullable().defaultTo(0);
      t.string('memo', 120);
      t.index(['item_id', 'entry_date']);
    });
  }

  if (!(await db.schema.hasTable('period_locks'))) {
    await db.schema.createTable('period_locks', (t) => {
      t.string('period', 7).primary(); // YYYY-MM
      t.timestamp('locked_at').defaultTo(db.fn.now());
      t.string('locked_by', 40);
    });
  }
}
