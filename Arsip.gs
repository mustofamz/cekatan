/**
 * ============================================================
 *  ARSIP CEKATAN — Firestore ➜ Google Spreadsheet
 * ------------------------------------------------------------
 *  OPSIONAL. Dipakai kalau Bapak/Ibu ingin Firestore memegang
 *  data yang sedang aktif, tapi Spreadsheet tetap dipertahankan
 *  untuk arsip, rekap DPJP, dan cetak laporan bulanan.
 *
 *  CARA PAKAI
 *  1. Buka Spreadsheet arsip > Ekstensi > Apps Script.
 *  2. Tempel seluruh isi berkas ini.
 *  3. Isi PROJECT_ID dan API_KEY di bawah (sama dengan
 *     firebase-config.js).
 *  4. Jalankan tarikDariFirestore() sekali untuk uji coba.
 *  5. Kalau berhasil: Pemicu (Triggers) > Tambah pemicu >
 *     tarikDariFirestore > Berbasis waktu > tiap 1 jam.
 *
 *  CATATAN: contoh ini membaca lewat REST API Firestore dengan
 *  aturan keamanan mode uji coba. Kalau nanti aturan sudah
 *  memakai login, akses dari sini perlu Service Account.
 * ============================================================
 */

const PROJECT_ID = 'GANTI-PROJECT-ID';
const API_KEY    = 'GANTI_DENGAN_API_KEY_ANDA';
const NAMA_SHEET = 'ARSIP';

function tarikDariFirestore() {
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
              '/databases/(default)/documents/pasien?key=' + API_KEY;

  const respon = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (respon.getResponseCode() !== 200) {
    throw new Error('Gagal membaca Firestore: ' + respon.getContentText());
  }

  const dokumen = JSON.parse(respon.getContentText()).documents || [];
  const baris = dokumen.map(function (d) {
    const f = d.fields || {};
    return [
      teks(f.nama), teks(f.rm), teks(f.kamar), teks(f.dpjp),
      teks(f.diagnosa), teks(f.ttv), teks(f.therapy), teks(f.status),
      planShift(f, 'PAGI'), planShift(f, 'SORE'), planShift(f, 'MALAM'),
      teks(f.diubahOleh), new Date()
    ];
  });

  const sheet = siapkanSheet();
  sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 13).clearContent();
  if (baris.length) sheet.getRange(2, 1, baris.length, 13).setValues(baris);

  Logger.log('Tersalin ' + baris.length + ' baris.');
}

function siapkanSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(NAMA_SHEET) || ss.insertSheet(NAMA_SHEET);
  const judul = ['NAMA', 'NO RM', 'KAMAR', 'DPJP', 'DIAGNOSA', 'TTV', 'THERAPY',
                 'STATUS', 'PLAN PAGI', 'PLAN SORE', 'PLAN MALAM',
                 'DIUBAH OLEH', 'DITARIK PADA'];
  sheet.getRange(1, 1, 1, judul.length).setValues([judul]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

/** Firestore membungkus tiap nilai, misalnya { stringValue: "SUNARTI" }. */
function teks(field) {
  if (!field) return '';
  return field.stringValue || field.integerValue || field.timestampValue || '';
}

function planShift(fields, shift) {
  try {
    const isi = fields.plan.mapValue.fields[shift].mapValue.fields;
    return teks(isi.isi) + ' — ' + teks(isi.oleh) + ' — ' + teks(isi.waktu);
  } catch (e) {
    return '';
  }
}
