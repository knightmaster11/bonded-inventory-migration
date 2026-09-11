VERSION 5.00
Object = "{CDE57A40-8B86-11D0-B3C6-00A0C90AEA82}#1.0#0"; "MSDATGRD.OCX"
Begin VB.Form frmPengeluaran
   Caption         =   "Pengeluaran Barang  (BC 3.0 / BC 2.5 / BC 2.7)"
   ClientHeight    =   6900
   ClientLeft      =   60
   ClientTop       =   345
   ClientWidth     =   10200
   LinkTopic       =   "Form1"
   ScaleHeight     =   6900
   ScaleWidth      =   10200
   StartUpPosition =   2  'CenterScreen
   Begin VB.ComboBox cboJenis
      Height          =   315
      ItemData        =   "frmPengeluaran.frx":0000
      List            =   "frmPengeluaran.frx":000D
      Left            =   1560
      Style           =   2  'Dropdown List
      TabIndex        =   0
      Top             =   240
      Width           =   1815
   End
   Begin VB.TextBox txtTanggal
      Height          =   315
      Left            =   1560
      TabIndex        =   1
      Top             =   660
      Width           =   1815
   End
   Begin VB.ComboBox cboPartner
      Height          =   315
      Left            =   1560
      Style           =   2  'Dropdown List
      TabIndex        =   2
      Top             =   1080
      Width           =   4335
   End
   Begin VB.TextBox txtReferensi
      Height          =   315
      Left            =   1560
      TabIndex        =   3
      Top             =   1500
      Width           =   4335
   End
   Begin MSDataGridLib.DataGrid grdDetail
      Height          =   3735
      Left            =   240
      TabIndex        =   4
      Top             =   2040
      Width           =   9735
      _ExtentX        =   17171
      _ExtentY        =   6588
      _Version        =   393216
      AllowUpdate     =   -1  'True
      HeadLines       =   1
      RowHeight       =   15
   End
   Begin VB.CommandButton cmdSimpan
      Caption         =   "&Simpan Draft"
      Height          =   375
      Left            =   6360
      TabIndex        =   5
      Top             =   6120
      Width           =   1695
   End
   Begin VB.CommandButton cmdPosting
      Caption         =   "&Posting"
      Height          =   375
      Left            =   8280
      TabIndex        =   6
      Top             =   6120
      Width           =   1695
   End
   Begin VB.Label lblNoDok
      Caption         =   "(nomor dibuat saat simpan)"
      ForeColor       =   &H00808080&
      Height          =   255
      Left            =   6360
      TabIndex        =   7
      Top             =   300
      Width           =   3615
   End
   Begin VB.Label Label1
      Caption         =   "Jenis BC"
      Height          =   255
      Left            =   240
      TabIndex        =   8
      Top             =   300
      Width           =   1215
   End
   Begin VB.Label Label2
      Caption         =   "Tanggal"
      Height          =   255
      Left            =   240
      TabIndex        =   9
      Top             =   720
      Width           =   1215
   End
   Begin VB.Label Label3
      Caption         =   "Pembeli / KB Tujuan"
      Height          =   255
      Left            =   240
      TabIndex        =   10
      Top             =   1140
      Width           =   1335
   End
   Begin VB.Label Label4
      Caption         =   "No. Aju / Invoice"
      Height          =   255
      Left            =   240
      TabIndex        =   11
      Top             =   1560
      Width           =   1335
   End
End
Attribute VB_Name = "frmPengeluaran"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

Private mIdDok As Long          ' 0 = belum disimpan
Private mNoDok As String

Private Sub Form_Load()
    cboJenis.Clear
    cboJenis.AddItem "BC30"
    cboJenis.AddItem "BC25"
    cboJenis.AddItem "BC27"
    cboJenis.ListIndex = 0
    txtTanggal.Text = Format(Date, "dd/mm/yyyy")
    IsiPartner
    mIdDok = 0
End Sub

Private Sub IsiPartner()
    Dim rs As DAO.Recordset
    cboPartner.Clear
    Set rs = db.OpenRecordset("SELECT KodePartner, NamaPartner FROM TblPartner " & _
                              "WHERE Jenis IN ('BUYER','BOTH','KB') ORDER BY NamaPartner")
    Do While Not rs.EOF
        cboPartner.AddItem rs!KodePartner & " - " & rs!NamaPartner
        rs.MoveNext
    Loop
    rs.Close
End Sub

' Simpan header + detail sebagai DRAFT. Nomor dokumen dibuat di sini.
Private Sub cmdSimpan_Click()
    Dim tgl As Date
    On Error GoTo ErrHandler

    ' Tanggal diketik user sebagai dd/mm/yyyy. CDate mengikuti regional
    ' setting Windows; di PC dengan regional en-US, 03/09/2026 dibaca
    ' 9 Maret. Pernah terjadi di PC ekspedisi.
    tgl = CDate(txtTanggal.Text)

    If mIdDok = 0 Then
        mNoDok = NomorDokumenBaru(cboJenis.Text, tgl)
        db.Execute "INSERT INTO TblDokumen (NoDokumen, Arah, JenisBC, Tanggal, KodePartner, Referensi, Status) " & _
                   "VALUES ('" & mNoDok & "', 'KELUAR', '" & cboJenis.Text & "', " & TglSQL(tgl) & ", '" & _
                   Left(cboPartner.Text, InStr(cboPartner.Text, " - ") - 1) & "', '" & _
                   Replace(txtReferensi.Text, "'", "''") & "', 'DRAFT')"
        mIdDok = db.OpenRecordset("SELECT @@IDENTITY")(0)
        lblNoDok.Caption = mNoDok
    End If
    SimpanDetail
    MsgBox "Tersimpan sebagai draft: " & mNoDok, vbInformation
    Exit Sub
ErrHandler:
    MsgBox "Gagal simpan: " & Err.Description, vbCritical
End Sub

Private Sub SimpanDetail()
    ' Hapus semua detail lalu insert ulang dari grid. Sederhana,
    ' tapi kalau grid punya baris kosong di tengah, baris itu ikut
    ' tersimpan dengan Qty 0 dan muncul di laporan.
    Dim i As Long
    db.Execute "DELETE FROM TblDetail WHERE IdDokumen=" & mIdDok
    grdDetail.Row = 0
    For i = 0 To grdDetail.ApproxCount - 1
        grdDetail.Row = i
        If Trim(grdDetail.Columns("KodeBarang").Text) <> "" Then
            db.Execute "INSERT INTO TblDetail (IdDokumen, KodeBarang, Qty, Satuan, NilaiSatuan, MataUang) VALUES (" & _
                       mIdDok & ", '" & grdDetail.Columns("KodeBarang").Text & "', " & _
                       Replace(grdDetail.Columns("Qty").Text, ",", ".") & ", '" & _
                       grdDetail.Columns("Satuan").Text & "', " & _
                       Replace(Nz(grdDetail.Columns("NilaiSatuan").Text, "0"), ",", ".") & ", '" & _
                       grdDetail.Columns("MataUang").Text & "')"
        End If
    Next i
End Sub

Private Sub cmdPosting_Click()
    If mIdDok = 0 Then
        MsgBox "Simpan dulu sebagai draft.", vbExclamation
        Exit Sub
    End If
    If MsgBox("Posting " & mNoDok & "? Dokumen yang sudah diposting tidak bisa diubah.", _
              vbYesNo + vbQuestion) = vbNo Then Exit Sub

    ' Tidak ada cek PeriodeTerkunci di sini. Lihat modInventory.
    PostingPengeluaran mIdDok
    Unload Me
End Sub
