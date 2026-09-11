VERSION 5.00
Begin VB.Form frmLaporanMutasi
   Caption         =   "Laporan Mutasi Bahan Baku / Barang Jadi"
   ClientHeight    =   2400
   ClientLeft      =   60
   ClientTop       =   345
   ClientWidth     =   6600
   LinkTopic       =   "Form1"
   ScaleHeight     =   2400
   ScaleWidth      =   6600
   StartUpPosition =   2  'CenterScreen
   Begin VB.ComboBox cboKategori
      Height          =   315
      Left            =   1680
      Style           =   2  'Dropdown List
      TabIndex        =   0
      Top             =   240
      Width           =   2415
   End
   Begin VB.TextBox txtDari
      Height          =   315
      Left            =   1680
      TabIndex        =   1
      Top             =   660
      Width           =   1455
   End
   Begin VB.TextBox txtSampai
      Height          =   315
      Left            =   1680
      TabIndex        =   2
      Top             =   1080
      Width           =   1455
   End
   Begin VB.CommandButton cmdExcel
      Caption         =   "Ke &Excel"
      Height          =   375
      Left            =   4560
      TabIndex        =   3
      Top             =   1800
      Width           =   1815
   End
   Begin VB.Label Label1
      Caption         =   "Kategori"
      Height          =   255
      Left            =   240
      TabIndex        =   4
      Top             =   300
      Width           =   1335
   End
   Begin VB.Label Label2
      Caption         =   "Dari tanggal"
      Height          =   255
      Left            =   240
      TabIndex        =   5
      Top             =   720
      Width           =   1335
   End
   Begin VB.Label Label3
      Caption         =   "Sampai tanggal"
      Height          =   255
      Left            =   240
      TabIndex        =   6
      Top             =   1140
      Width           =   1335
   End
End
Attribute VB_Name = "frmLaporanMutasi"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' Laporan pertanggungjawaban mutasi, format yang diminta petugas BC:
'   Kode | Nama | Satuan | Saldo Awal | Pemasukan | Pengeluaran | Penyesuaian | Saldo Akhir
'
' Dihitung per barang dengan 4 query SUM terpisah, lalu ditulis
' sel per sel ke Excel lewat automation. 250 barang = 1000 query
' + 2000 kali tulis sel. Sekitar 6 menit di PC gudang.

Private Sub Form_Load()
    cboKategori.AddItem "BAHAN BAKU"
    cboKategori.AddItem "BARANG JADI"
    cboKategori.ListIndex = 0
    txtDari.Text = "01/" & Format(Date, "mm/yyyy")
    txtSampai.Text = Format(Date, "dd/mm/yyyy")
End Sub

Private Sub cmdExcel_Click()
    Dim xl As Object, wb As Object, ws As Object
    Dim rs As DAO.Recordset
    Dim dari As Date, sampai As Date
    Dim baris As Long
    Dim awal As Double, masuk As Double, keluar As Double, adj As Double
    Dim kat As String

    On Error GoTo ErrHandler
    dari = CDate(txtDari.Text)
    sampai = CDate(txtSampai.Text)
    If cboKategori.Text = "BAHAN BAKU" Then kat = "RAW" Else kat = "FG"

    Set xl = CreateObject("Excel.Application")
    Set wb = xl.Workbooks.Add
    Set ws = wb.Worksheets(1)

    ws.Cells(1, 1) = NAMA_PERUSAHAAN
    ws.Cells(2, 1) = "NPPBKC " & NPPBKC
    ws.Cells(3, 1) = "LAPORAN PERTANGGUNGJAWABAN MUTASI " & cboKategori.Text
    ws.Cells(4, 1) = "Periode " & Format(dari, "dd-mm-yyyy") & " s/d " & Format(sampai, "dd-mm-yyyy")

    ws.Cells(6, 1) = "Kode":        ws.Cells(6, 2) = "Nama Barang"
    ws.Cells(6, 3) = "Satuan":      ws.Cells(6, 4) = "Saldo Awal"
    ws.Cells(6, 5) = "Pemasukan":   ws.Cells(6, 6) = "Pengeluaran"
    ws.Cells(6, 7) = "Penyesuaian": ws.Cells(6, 8) = "Saldo Akhir"
    baris = 7

    Set rs = db.OpenRecordset("SELECT KodeBarang, NamaBarang, Satuan FROM TblBarang " & _
                              "WHERE Kategori='" & kat & "' ORDER BY KodeBarang")
    Do While Not rs.EOF
        awal = SumMutasi(rs!KodeBarang, "Tanggal < " & TglSQL(dari), "")
        masuk = SumMutasi(rs!KodeBarang, "Tanggal >= " & TglSQL(dari) & " AND Tanggal <= " & TglSQL(sampai), "Keterangan='Pemasukan'")
        keluar = SumMutasi(rs!KodeBarang, "Tanggal >= " & TglSQL(dari) & " AND Tanggal <= " & TglSQL(sampai), "Keterangan='Pengeluaran'")
        adj = SumMutasi(rs!KodeBarang, "Tanggal >= " & TglSQL(dari) & " AND Tanggal <= " & TglSQL(sampai), "Keterangan='Opname'")

        ws.Cells(baris, 1) = rs!KodeBarang
        ws.Cells(baris, 2) = rs!NamaBarang
        ws.Cells(baris, 3) = rs!Satuan
        ws.Cells(baris, 4) = awal
        ws.Cells(baris, 5) = masuk
        ws.Cells(baris, 6) = keluar
        ws.Cells(baris, 7) = adj
        ws.Cells(baris, 8) = awal + masuk - keluar + adj
        baris = baris + 1
        rs.MoveNext
    Loop
    rs.Close

    xl.Visible = True
    Exit Sub
ErrHandler:
    MsgBox "Gagal membuat laporan: " & Err.Description, vbCritical
    On Error Resume Next
    xl.Quit
End Sub

' Kalau filterKet kosong, hitung netto (masuk - keluar).
' Kalau ada, hitung sesuai jenis: Pemasukan -> QtyMasuk, Pengeluaran -> QtyKeluar,
' Opname -> QtyMasuk - QtyKeluar.
Private Function SumMutasi(kode As String, filterTgl As String, filterKet As String) As Double
    Dim rs As DAO.Recordset
    Dim sql As String
    sql = "SELECT SUM(QtyMasuk) AS M, SUM(QtyKeluar) AS K FROM TblMutasi WHERE KodeBarang='" & kode & "' AND " & filterTgl
    If filterKet <> "" Then sql = sql & " AND " & filterKet
    Set rs = db.OpenRecordset(sql)
    Select Case filterKet
        Case "Keterangan='Pemasukan'":   SumMutasi = Nz(rs!M, 0)
        Case "Keterangan='Pengeluaran'": SumMutasi = Nz(rs!K, 0)
        Case Else:                       SumMutasi = Nz(rs!M, 0) - Nz(rs!K, 0)
    End Select
    rs.Close
End Function
