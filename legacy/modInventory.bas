Attribute VB_Name = "modInventory"
Option Explicit

' ============================================================
'  modInventory.bas  -  logika bisnis inventory Kawasan Berikat
'
'  Jenis dokumen pabean yang dikenal aplikasi ini:
'    Pemasukan  : BC 2.3 (impor ke KB), BC 4.0 (dari TLDDP),
'                 BC 2.7 (dari KB lain)
'    Pengeluaran: BC 3.0 (ekspor), BC 2.5 (ke TLDDP, bayar BM/PPN),
'                 BC 2.7 (ke KB lain)
'    Penyesuaian: OPNAME (hasil stock opname)
'
'  Semua stok dihitung dari TblMutasi (QtyMasuk - QtyKeluar).
'  Tidak ada tabel saldo. Ini disengaja oleh pembuat awal supaya
'  laporan mutasi ke Bea Cukai selalu bisa direkonstruksi.
' ============================================================

Public Const JENIS_MASUK As String = "BC23,BC40,BC27"
Public Const JENIS_KELUAR As String = "BC30,BC25,BC27"

' ------------------------------------------------------------
' Saldo stok satu barang = total masuk - total keluar.
' Dipanggil per baris saat posting, jadi pada dokumen 40 baris
' query SUM ini jalan 40 kali. Lambat di TblMutasi yang sudah
' 300 ribu baris (keluhan user sejak 2019).
' ------------------------------------------------------------
Public Function GetSaldo(kodeBarang As String) As Double
    Dim rs As DAO.Recordset
    Set rs = db.OpenRecordset("SELECT SUM(QtyMasuk) - SUM(QtyKeluar) AS Saldo " & _
                              "FROM TblMutasi WHERE KodeBarang='" & kodeBarang & "'")
    If IsNull(rs!Saldo) Then
        GetSaldo = 0
    Else
        GetSaldo = rs!Saldo
    End If
    rs.Close
End Function

' ------------------------------------------------------------
' Nomor dokumen: JENIS/TAHUN/BULAN/URUT, contoh BC23/2026/09/0007
' Urutan dihitung per jenis per bulan dari nomor terbesar yang ada.
' Dua user posting bersamaan bisa dapat nomor yang sama (pernah
' terjadi, diperbaiki manual di Access).
' ------------------------------------------------------------
Public Function NomorDokumenBaru(jenisBC As String, tgl As Date) As String
    Dim prefix As String
    Dim rs As DAO.Recordset
    Dim urut As Long

    prefix = jenisBC & "/" & Format(tgl, "yyyy") & "/" & Format(tgl, "mm") & "/"
    Set rs = db.OpenRecordset("SELECT MAX(NoDokumen) AS NoMax FROM TblDokumen " & _
                              "WHERE NoDokumen LIKE '" & prefix & "*'")
    If IsNull(rs!NoMax) Then
        urut = 1
    Else
        urut = CLng(Right(rs!NoMax, 4)) + 1
    End If
    rs.Close
    NomorDokumenBaru = prefix & Format(urut, "0000")
End Function

' ------------------------------------------------------------
' Cek apakah periode (bulan) sudah dikunci setelah lapor ke BC.
' Dipanggil dari form pemasukan, TIDAK dipanggil dari form
' pengeluaran. Ditemukan saat audit internal 2022.
' ------------------------------------------------------------
Public Function PeriodeTerkunci(tgl As Date) As Boolean
    Dim rs As DAO.Recordset
    Set rs = db.OpenRecordset("SELECT Terkunci FROM TblPeriode " & _
                              "WHERE Periode='" & Format(tgl, "yyyy-mm") & "'")
    If rs.EOF Then
        PeriodeTerkunci = False
    Else
        PeriodeTerkunci = (rs!Terkunci = True)
    End If
    rs.Close
End Function

' ------------------------------------------------------------
' POSTING PEMASUKAN
' Setiap baris detail jadi satu baris mutasi masuk.
' ------------------------------------------------------------
Public Sub PostingPemasukan(idDok As Long, tglDok As Date)
    Dim rsDet As DAO.Recordset

    If PeriodeTerkunci(tglDok) Then
        MsgBox "Periode " & Format(tglDok, "mm-yyyy") & " sudah dikunci.", vbExclamation
        Exit Sub
    End If

    Set rsDet = db.OpenRecordset("SELECT * FROM TblDetail WHERE IdDokumen=" & idDok)
    Do While Not rsDet.EOF
        db.Execute "INSERT INTO TblMutasi (KodeBarang, IdDokumen, Tanggal, QtyMasuk, QtyKeluar, Keterangan) " & _
                   "VALUES ('" & rsDet!KodeBarang & "', " & idDok & ", " & TglSQL(tglDok) & ", " & _
                   Replace(CStr(rsDet!Qty), ",", ".") & ", 0, 'Pemasukan')"
        rsDet.MoveNext
    Loop
    rsDet.Close
    db.Execute "UPDATE TblDokumen SET Status='POSTED', TglPosting=Now() WHERE IdDokumen=" & idDok
End Sub

' ------------------------------------------------------------
' POSTING PENGELUARAN
' Aturan: stok tidak boleh minus. Dicek per baris.
'
' CATATAN: tidak ada transaksi. Kalau baris ke-5 dari 12 gagal
' karena stok kurang, baris 1-4 sudah terlanjur masuk TblMutasi
' dan dokumennya tetap DRAFT. User biasanya posting ulang, dan
' baris 1-4 jadi dobel. Ini sumber selisih di laporan mutasi
' yang tiap tahun harus dijelaskan ke petugas BC.
' ------------------------------------------------------------
Public Sub PostingPengeluaran(idDok As Long)
    Dim rsDet As DAO.Recordset
    Dim rsDok As DAO.Recordset
    Dim jenis As String

    Set rsDok = db.OpenRecordset("SELECT JenisBC FROM TblDokumen WHERE IdDokumen=" & idDok)
    jenis = rsDok!JenisBC
    rsDok.Close

    Set rsDet = db.OpenRecordset("SELECT * FROM TblDetail WHERE IdDokumen=" & idDok)
    Do While Not rsDet.EOF
        If GetSaldo(rsDet!KodeBarang) < rsDet!Qty Then
            MsgBox "Stok tidak cukup untuk " & rsDet!KodeBarang & _
                   " (saldo " & GetSaldo(rsDet!KodeBarang) & ", diminta " & rsDet!Qty & ")", vbExclamation
            rsDet.Close
            Exit Sub    ' <-- baris sebelumnya sudah terlanjur diposting
        End If

        ' BC 2.5 wajib punya nilai pabean untuk dasar BM dan PPN.
        ' Dicek di sini, tapi hanya MsgBox, tidak menghentikan posting.
        If jenis = "BC25" And Nz(rsDet!NilaiSatuan, 0) = 0 Then
            MsgBox "Nilai pabean kosong untuk " & rsDet!KodeBarang, vbInformation
        End If

        ' Tanggal mutasi memakai tanggal HARI INI (Date), bukan tanggal
        ' dokumen. Kalau dokumen tanggal 30 diposting tanggal 2 bulan
        ' berikutnya, mutasinya masuk ke bulan yang salah.
        db.Execute "INSERT INTO TblMutasi (KodeBarang, IdDokumen, Tanggal, QtyMasuk, QtyKeluar, Keterangan) " & _
                   "VALUES ('" & rsDet!KodeBarang & "', " & idDok & ", " & TglSQL(Date) & ", 0, " & _
                   Replace(CStr(rsDet!Qty), ",", ".") & ", 'Pengeluaran')"
        rsDet.MoveNext
    Loop
    rsDet.Close
    db.Execute "UPDATE TblDokumen SET Status='POSTED', TglPosting=Now() WHERE IdDokumen=" & idDok
End Sub

' ------------------------------------------------------------
' Penyesuaian hasil stock opname: selisih positif jadi masuk,
' negatif jadi keluar. Dokumen POSTED tidak pernah dibatalkan;
' koreksi selalu lewat opname. Aturan ini dipegang ketat karena
' petugas BC minta jejak audit.
' ------------------------------------------------------------
Public Sub PostingOpname(idDok As Long, tglDok As Date)
    Dim rsDet As DAO.Recordset
    Dim selisih As Double

    Set rsDet = db.OpenRecordset("SELECT * FROM TblDetail WHERE IdDokumen=" & idDok)
    Do While Not rsDet.EOF
        selisih = rsDet!Qty
        If selisih >= 0 Then
            db.Execute "INSERT INTO TblMutasi (KodeBarang, IdDokumen, Tanggal, QtyMasuk, QtyKeluar, Keterangan) " & _
                       "VALUES ('" & rsDet!KodeBarang & "', " & idDok & ", " & TglSQL(tglDok) & ", " & _
                       Replace(CStr(selisih), ",", ".") & ", 0, 'Opname')"
        Else
            db.Execute "INSERT INTO TblMutasi (KodeBarang, IdDokumen, Tanggal, QtyMasuk, QtyKeluar, Keterangan) " & _
                       "VALUES ('" & rsDet!KodeBarang & "', " & idDok & ", " & TglSQL(tglDok) & ", 0, " & _
                       Replace(CStr(Abs(selisih)), ",", ".") & ", 'Opname')"
        End If
        rsDet.MoveNext
    Loop
    rsDet.Close
    db.Execute "UPDATE TblDokumen SET Status='POSTED', TglPosting=Now() WHERE IdDokumen=" & idDok
End Sub

' Pengganti Nz() Access untuk dipakai dari VB6
Public Function Nz(v As Variant, Optional dflt As Variant = 0) As Variant
    If IsNull(v) Then Nz = dflt Else Nz = v
End Function
