Attribute VB_Name = "modDB"
Option Explicit

' ============================================================
'  modDB.bas  -  koneksi database Access (DAO 3.6)
'  Inventory Kawasan Berikat  -  PT Contoh Garmen Indonesia
'  Terakhir diubah: 2011 (perkiraan, tidak ada version control)
' ============================================================

Public db As DAO.Database
Public Const NAMA_DB As String = "Inventory.mdb"

' Nama perusahaan dan NPPBKC di-hardcode di sini dan dipakai
' di header semua laporan. Kalau ganti perusahaan, ganti di sini.
Public Const NAMA_PERUSAHAAN As String = "PT CONTOH GARMEN INDONESIA"
Public Const NPPBKC As String = "1234567890"

Public Sub BukaDB()
    On Error GoTo ErrHandler
    Set db = DBEngine.OpenDatabase(App.Path & "\" & NAMA_DB)
    Exit Sub
ErrHandler:
    MsgBox "Gagal membuka database: " & Err.Description, vbCritical, "Inventory KB"
    End
End Sub

Public Sub TutupDB()
    On Error Resume Next
    db.Close
    Set db = Nothing
End Sub

' Format tanggal untuk query Access. Access butuh #mm/dd/yyyy#.
' Fungsi ini dipanggil dari banyak tempat, tapi tidak semua
' tempat memakainya (lihat modInventory.PostingPengeluaran).
Public Function TglSQL(t As Date) As String
    TglSQL = "#" & Format(t, "mm/dd/yyyy") & "#"
End Function
