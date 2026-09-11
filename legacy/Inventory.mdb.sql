-- ============================================================
--  Inventory.mdb  -  skema Access 2003 (Jet 4.0), diekspor manual
--  Aplikasi: Inventory Kawasan Berikat (VB6)
--  Tidak ada relasi (Relationships) yang didefinisikan di Access;
--  integritas referensial dijaga oleh aplikasi, kadang-kadang.
-- ============================================================

-- Master barang. Kategori: RAW = bahan baku, FG = barang jadi,
-- AUX = bahan penolong, MACHINE = mesin/peralatan.
CREATE TABLE TblBarang (
    KodeBarang   TEXT(30)   NOT NULL PRIMARY KEY,
    NamaBarang   TEXT(120)  NOT NULL,
    Satuan       TEXT(10)   NOT NULL,          -- PCS, MTR, KG, ROLL, SET
    Kategori     TEXT(10)   NOT NULL,          -- RAW / FG / AUX / MACHINE
    HSCode       TEXT(12),
    Aktif        YESNO      DEFAULT Yes
);

-- Master supplier / pembeli / KB lain
CREATE TABLE TblPartner (
    KodePartner  TEXT(20)   NOT NULL PRIMARY KEY,
    NamaPartner  TEXT(120)  NOT NULL,
    Negara       TEXT(2),                      -- ID = dalam negeri (TLDDP)
    Jenis        TEXT(10)                      -- SUPPLIER / BUYER / BOTH / KB
);

-- Header dokumen pabean
CREATE TABLE TblDokumen (
    IdDokumen    AUTOINCREMENT PRIMARY KEY,
    NoDokumen    TEXT(40)   NOT NULL,          -- BC23/2026/09/0001 (tidak ada UNIQUE index)
    Arah         TEXT(10)   NOT NULL,          -- MASUK / KELUAR / OPNAME
    JenisBC      TEXT(10)   NOT NULL,          -- BC23 BC40 BC27 BC30 BC25 OPNAME
    Tanggal      DATETIME   NOT NULL,
    KodePartner  TEXT(20),
    Referensi    TEXT(60),                     -- nomor aju / invoice / BA opname
    Status       TEXT(10)   DEFAULT 'DRAFT',   -- DRAFT / POSTED
    TglPosting   DATETIME,
    Keterangan   MEMO
);

-- Detail baris dokumen
CREATE TABLE TblDetail (
    IdDetail     AUTOINCREMENT PRIMARY KEY,
    IdDokumen    LONG       NOT NULL,
    KodeBarang   TEXT(30)   NOT NULL,
    Qty          DOUBLE     NOT NULL,          -- untuk OPNAME boleh negatif (selisih)
    Satuan       TEXT(10),
    NilaiSatuan  DOUBLE,                       -- nilai pabean per satuan, wajib untuk BC25
    MataUang     TEXT(3)                       -- USD / IDR
);

-- Buku mutasi. Satu-satunya sumber kebenaran untuk saldo stok.
-- Saldo = SUM(QtyMasuk) - SUM(QtyKeluar) per KodeBarang.
-- Keterangan dipakai sebagai "jenis" oleh laporan (Pemasukan / Pengeluaran / Opname).
CREATE TABLE TblMutasi (
    IdMutasi     AUTOINCREMENT PRIMARY KEY,
    KodeBarang   TEXT(30)   NOT NULL,
    IdDokumen    LONG,
    Tanggal      DATETIME   NOT NULL,
    QtyMasuk     DOUBLE     DEFAULT 0,
    QtyKeluar    DOUBLE     DEFAULT 0,
    Keterangan   TEXT(50)
);

-- Kunci periode setelah laporan bulanan dikirim ke Bea Cukai
CREATE TABLE TblPeriode (
    Periode      TEXT(7)    NOT NULL PRIMARY KEY,   -- yyyy-mm
    Terkunci     YESNO      DEFAULT No,
    TglKunci     DATETIME,
    Oleh         TEXT(30)
);

-- Tabel lama yang tidak dipakai lagi tapi tidak pernah dihapus.
-- Berisi data 2009-2012 dari versi Excel sebelum aplikasi VB6.
CREATE TABLE TblStokLama (
    Kode         TEXT(30),
    Nama         TEXT(120),
    Stok         DOUBLE,
    TglUpdate    TEXT(10)                       -- disimpan sebagai teks dd/mm/yyyy
);
