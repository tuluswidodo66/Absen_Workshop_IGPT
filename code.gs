/**
 * Google Apps Script - Backend untuk Sistem Absensi Workshop IGPT Tuban
 * 
 * Petunjuk Penggunaan:
 * 1. Buka Google Sheets baru, buat sheet kosong.
 * 2. Klik menu "Ekstensi" -> "Apps Script".
 * 3. Hapus semua kode default di Apps Script, lalu salin (copy-paste) seluruh isi file ini.
 * 4. Ganti 'NAMA_FOLDER_FOTO_ANDA' (opsional) untuk menyimpan foto peserta di Google Drive Anda.
 * 5. Klik ikon "Simpan" (Save).
 * 6. Klik tombol "Terapkan" (Deploy) -> "Terapkan Baru" (New Deployment).
 * 7. Pilih Jenis: "Aplikasi Web" (Web App).
 * 8. Konfigurasi:
 *    - Jalankan sebagai: "Saya" (Me - email anda).
 *    - Siapa yang memiliki akses: "Siapa saja" (Anyone).
 * 9. Klik "Terapkan" (Deploy) dan setujui izin akses (Authorize access).
 * 10. Salin URL Aplikasi Web yang diberikan, lalu masukkan ke kolom "URL Apps Script" di aplikasi absensi.
 */

// Konfigurasi Nama Folder untuk menyimpan Foto Wajah di Google Drive
const FOLDER_NAME = "Foto_Absensi_Workshop_Tuban";

function getSheet() {
  let ss = null;
  
  // Method 1: Coba ambil active spreadsheet (jika script ini container-bound)
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    // Abaikan jika bukan container-bound
  }
  
  // Method 2: Coba cari di Google Drive file bernama "Database_Absensi_Workshop_Tuban" jika ss masih null
  if (!ss) {
    try {
      const files = DriveApp.getFilesByName("Database_Absensi_Workshop_Tuban");
      if (files.hasNext()) {
        ss = SpreadsheetApp.open(files.next());
      } else {
        // Jika sama sekali tidak ada, buat baru otomatis di Google Drive!
        ss = SpreadsheetApp.create("Database_Absensi_Workshop_Tuban");
      }
    } catch (e) {
      throw new Error("Gagal mengakses Google Drive untuk mencari/membuat Spreadsheet. Pastikan izin akses DriveApp telah disetujui. Detail: " + e.toString());
    }
  }
  
  if (!ss) {
    throw new Error("Gagal menginisialisasi Google Spreadsheet.");
  }

  let sheet = ss.getActiveSheet();
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  return sheet;
}

function doGet(e) {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Ambil seluruh baris data dari baris ke-2 hingga terakhir
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 6);
    const values = dataRange.getValues();
    
    const logs = values.map(row => {
      // Ubah Google Drive file URL menjadi direct view link jika memungkinkan
      let fotoUrl = row[4] || "";
      if (fotoUrl.indexOf("drive.google.com") !== -1) {
        const fileIdMatch = fotoUrl.match(/\/file\/d\/([^\/]+)/) || fotoUrl.match(/id=([^&]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          fotoUrl = "https://lh3.googleusercontent.com/d/" + fileIdMatch[1];
        }
      }
      return {
        id: row[0] || Date.now(),
        waktu: row[1] || "",
        nama: row[2] || "",
        instansi: row[3] || "",
        foto: fotoUrl
      };
    });
    
    // Urutkan dari yang terbaru (reverse)
    logs.reverse();
    
    return ContentService.createTextOutput(JSON.stringify(logs))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    let data;
    
    // Parse data yang masuk
    if (e.postData.type === "application/json") {
      data = JSON.parse(e.postData.contents);
    } else {
      data = JSON.parse(e.postData.getDataAsString());
    }
    
    const nama = data.nama || "Tanpa Nama";
    const instansi = data.instansi || "Tanpa Instansi";
    const waktu = data.waktu || new Date().toLocaleString();
    const fotoBase64 = data.foto || ""; // Base64 image data
    
    // Buka spreadsheet
    const sheet = getSheet();
    
    // Jika sheet masih kosong, buat header terlebih dahulu
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["No", "Waktu Absen", "Nama Lengkap", "Asal Instansi / Sekolah", "Link Foto Wajah", "Tanggal Ditambahkan"]);
      // Buat format bold untuk header
      sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f1f5f9");
    }
    
    const no = sheet.getLastRow(); // Nomor baris selanjutnya sebagai nomor urut
    
    let linkFoto = "Tidak Ada Foto";
    
    // Jika ada foto, simpan ke Google Drive
    if (fotoBase64 && fotoBase64.startsWith("data:image")) {
      linkFoto = simpanFotoKeDrive(fotoBase64, nama, instansi);
    }
    
    // Tambahkan data ke spreadsheet
    sheet.appendRow([
      no,
      waktu,
      nama,
      instansi,
      linkFoto,
      new Date()
    ]);
    
    // Kembalikan URL direct view untuk rendering cepat di client
    let directFotoUrl = linkFoto;
    if (linkFoto.indexOf("drive.google.com") !== -1) {
      const fileIdMatch = linkFoto.match(/\/file\/d\/([^\/]+)/) || linkFoto.match(/id=([^&]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        directFotoUrl = "https://lh3.googleusercontent.com/d/" + fileIdMatch[1];
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Data berhasil disimpan!", 
      row: no,
      linkFoto: directFotoUrl 
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Fungsi untuk menyimpan file gambar Base64 ke Google Drive
 */
function simpanFotoKeDrive(base64Data, nama, instansi) {
  try {
    // Cari atau buat folder penyimpanan di Google Drive
    let folder;
    const folders = DriveApp.getFoldersByName(FOLDER_NAME);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(FOLDER_NAME);
    }
    
    // Ekstrak data base64 murni
    const rawData = base64Data.split(",")[1];
    const contentType = base64Data.split(",")[0].split(":")[1].split(";")[0];
    const blob = Utilities.newBlob(Utilities.base64Decode(rawData), contentType);
    
    // Format nama file: Nama_Instansi_Waktu.jpg
    const namaFileClean = nama.replace(/[^a-zA-Z0-9]/g, "_") + "_" + instansi.replace(/[^a-zA-Z0-9]/g, "_") + "_" + new Date().getTime();
    blob.setName(namaFileClean + ".jpg");
    
    // Simpan file ke folder Drive
    const file = folder.createFile(blob);
    
    // Berikan izin akses agar gambar bisa dibuka melalui tautan
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (err) {
    return "Error menyimpan foto: " + err.toString();
  }
}

/**
 * Fungsi pembantu untuk mengizinkan CORS Preflight (OPTIONS)
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
