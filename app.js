// ============================================================
//  CEKATAN — dummy Firebase + Vercel
//  Peran berkas ini: menyambung ke Firestore, mendengarkan
//  perubahan data secara real-time, dan menggambar tampilan.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, KOLEKSI_PASIEN } from "./firebase-config.js";

/* ---------- data acuan (di aplikasi asli diambil dari sheet DB) ---------- */
const KAMAR = [
  "2A","2B","2C","2D","2E","2F","2G","2H","2I","2J",
  ...Array.from({length:34},(_,i)=>String(i+1))
];
const DPJP = [
  "dr. TYAS, Sp.P","dr. FEBRI, Sp.GK","drg. MONIKA, Sp.KG",
  "dr. ANDI, Sp.PD","dr. RATNA, Sp.B","dr. HERU, Sp.OG","dr. WAHYU, Sp.A"
];
const SHIFT_BERIKUT = { PAGI:"SORE", SORE:"MALAM", MALAM:"PAGI" };

/* ---------- sambungan Firebase ---------- */
let db = null, koleksi = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  koleksi = collection(db, KOLEKSI_PASIEN);
} catch (e) {
  console.error(e);
}

/* ---------- keadaan aplikasi ---------- */
let petugas = null;          // { nama, shift }
let semuaPasien = [];        // hasil terakhir dari Firestore
let sedangDiedit = null;     // id dokumen yang sedang dibuka, null = tambah baru

const $ = (id) => document.getElementById(id);

/* ============================================================
   GERBANG PETUGAS
   ============================================================ */
$("g-shift").addEventListener("click", (e) => {
  const tombol = e.target.closest("button[data-shift]");
  if (!tombol) return;
  [...$("g-shift").children].forEach(b => b.setAttribute("aria-pressed", b === tombol));
});

$("g-masuk").addEventListener("click", () => {
  const nama = $("g-nama").value.trim();
  const dipilih = $("g-shift").querySelector('[aria-pressed="true"]');
  if (!nama || !dipilih) {
    tampilGalat($("g-pesan"), "Isi nama petugas dan pilih shift jaga dulu.");
    return;
  }
  petugas = { nama, shift: dipilih.dataset.shift };
  sessionStorage.setItem("cekatan-petugas", JSON.stringify(petugas));
  mulaiAplikasi();
});

$("btn-ganti").addEventListener("click", () => {
  sessionStorage.removeItem("cekatan-petugas");
  location.reload();
});

// lanjutkan sesi kalau halaman disegarkan
const tersimpan = sessionStorage.getItem("cekatan-petugas");
if (tersimpan) { petugas = JSON.parse(tersimpan); mulaiAplikasi(); }

/* ============================================================
   MULAI
   ============================================================ */
function mulaiAplikasi() {
  $("gerbang").hidden = true;
  $("app").hidden = false;

  const b = $("badge-shift");
  b.textContent = `${petugas.shift} · ${petugas.nama}`;
  b.dataset.s = petugas.shift;
  $("lbl-shift-berikut").textContent = SHIFT_BERIKUT[petugas.shift];
  $("lbl-plan").textContent = `Rencana shift ${SHIFT_BERIKUT[petugas.shift]}`;

  isiPilihan($("f-kamar"), KAMAR);
  isiPilihan($("f-dpjp"), DPJP);
  dengarkanData();
}

function isiPilihan(select, daftar) {
  select.innerHTML = daftar.map(v => `<option>${v}</option>`).join("");
}

/* ============================================================
   MENDENGARKAN DATA SECARA REAL-TIME
   Inilah bedanya dengan Spreadsheet: onSnapshot dipanggil ulang
   otomatis setiap ada perubahan dari perangkat mana pun.
   ============================================================ */
function dengarkanData() {
  const lampu = $("status-sambung");

  if (!koleksi) {
    lampu.className = "status-sambung galat";
    lampu.innerHTML = "<i></i>konfigurasi belum diisi";
    return;
  }

  const kueri = query(koleksi, orderBy("dibuat", "desc"));

  onSnapshot(kueri,
    (cuplikan) => {
      lampu.className = "status-sambung hidup";
      lampu.innerHTML = "<i></i>tersambung";
      semuaPasien = cuplikan.docs.map(d => ({ id: d.id, ...d.data() }));
      gambarDaftar();
    },
    (galat) => {
      console.error(galat);
      lampu.className = "status-sambung galat";
      lampu.innerHTML = "<i></i>gagal menyambung";
      toast("Gagal membaca data. Periksa aturan keamanan Firestore.");
    }
  );
}

/* ============================================================
   MENGGAMBAR DAFTAR
   ============================================================ */
$("cari").addEventListener("input", gambarDaftar);
$("tampil-semua").addEventListener("change", gambarDaftar);

function gambarDaftar() {
  const kunci = $("cari").value.trim().toLowerCase();
  const tampilSemua = $("tampil-semua").checked;
  const planKe = SHIFT_BERIKUT[petugas.shift];

  const dirawat = semuaPasien.filter(p => p.status === "DIRAWAT");
  $("jml-dirawat").textContent = dirawat.length;
  $("jml-keluar").textContent = semuaPasien.length - dirawat.length;
  $("jml-belum").textContent = dirawat.filter(p => !(p.plan?.[planKe]?.isi)).length;

  let tampil = tampilSemua ? semuaPasien : dirawat;
  if (kunci) {
    tampil = tampil.filter(p =>
      [p.nama, p.kamar, p.dpjp, p.diagnosa, p.rm].join(" ").toLowerCase().includes(kunci)
    );
  }

  $("kosong").hidden = tampil.length > 0;
  $("daftar").innerHTML = tampil.map(p => kartu(p, planKe)).join("");

  document.querySelectorAll(".kartu").forEach(el => {
    el.addEventListener("click", () => bukaPanel(el.dataset.id));
  });
}

function kartu(p, planKe) {
  const plan = p.plan?.[planKe];
  const poin = plan?.isi
    ? `<ol>${plan.isi.split("|").map(t => `<li>${amankan(t.trim())}</li>`).join("")}</ol>
       <p class="plan-jejak">${amankan(plan.oleh || "—")} · ${plan.waktu || "—"}</p>`
    : `<p class="plan-kosong">Rencana ${planKe} belum diisi</p>`;

  return `
  <button class="kartu ${p.status !== "DIRAWAT" ? "keluar" : ""}" data-id="${p.id}">
    <div class="kartu-atas">
      <span class="kartu-nama">${amankan(p.nama)}</span>
      <span class="kartu-kamar">${amankan(p.kamar)}</span>
    </div>
    <p class="kartu-meta"><b>${amankan(p.dpjp)}</b> — ${amankan(p.diagnosa || "diagnosa belum diisi")}</p>
    ${p.ttv ? `<p class="kartu-ttv">${amankan(p.ttv)}</p>` : ""}
    <span class="kartu-status" data-s="${p.status}">${p.status}</span>
    <div class="plan">
      <p class="plan-judul">Rencana ${planKe}</p>
      ${poin}
    </div>
  </button>`;
}

const amankan = (t) => String(t ?? "").replace(/[<>&"]/g, c =>
  ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));

/* ============================================================
   PANEL TAMBAH / UBAH
   ============================================================ */
$("btn-tambah").addEventListener("click", () => bukaPanel(null));
$("panel-tutup").addEventListener("click", tutupPanel);
$("tirai").addEventListener("click", tutupPanel);
document.addEventListener("keydown", e => { if (e.key === "Escape") tutupPanel(); });

function bukaPanel(id) {
  sedangDiedit = id;
  const p = id ? semuaPasien.find(x => x.id === id) : null;
  const planKe = SHIFT_BERIKUT[petugas.shift];

  $("panel-judul").textContent = p ? "Ubah data pasien" : "Tambah pasien";
  $("f-nama").value = p?.nama || "";
  $("f-rm").value = p?.rm || "";
  $("f-kamar").value = p?.kamar || KAMAR[0];
  $("f-dpjp").value = p?.dpjp || DPJP[0];
  $("f-diagnosa").value = p?.diagnosa || "";
  $("f-ttv").value = p?.ttv || "";
  $("f-therapy").value = p?.therapy || "";
  $("f-status").value = p?.status || "DIRAWAT";
  $("f-plan").value = p?.plan?.[planKe]?.isi || "";
  $("f-hapus").hidden = !p;
  $("f-pesan").hidden = true;

  $("tirai").hidden = false;
  $("panel").hidden = false;
  $("f-nama").focus();
}

function tutupPanel() {
  $("panel").hidden = true;
  $("tirai").hidden = true;
  sedangDiedit = null;
}

/* ---------- simpan ---------- */
$("f-simpan").addEventListener("click", async () => {
  const nama = $("f-nama").value.trim().toUpperCase();
  if (!nama) { tampilGalat($("f-pesan"), "Nama pasien belum diisi."); return; }

  const planKe = SHIFT_BERIKUT[petugas.shift];
  const isiPlan = $("f-plan").value.trim();

  const data = {
    nama,
    rm: $("f-rm").value.trim(),
    kamar: $("f-kamar").value,
    dpjp: $("f-dpjp").value,
    diagnosa: $("f-diagnosa").value.trim().toUpperCase(),
    ttv: $("f-ttv").value.trim(),
    therapy: $("f-therapy").value.trim(),
    status: $("f-status").value,
    diubahOleh: `${petugas.nama} (${petugas.shift})`,
    diubah: serverTimestamp()
  };

  // Rencana disimpan per shift lengkap dengan jejak siapa & kapan mengisi.
  if (isiPlan) {
    data[`plan.${planKe}`] = {
      isi: isiPlan,
      oleh: `${petugas.nama} (${petugas.shift})`,
      waktu: capWaktu()
    };
  }

  $("f-simpan").disabled = true;
  try {
    if (sedangDiedit) {
      await updateDoc(doc(db, KOLEKSI_PASIEN, sedangDiedit), data);
      toast("Data pasien diperbarui");
    } else {
      const baru = { ...data, dibuat: serverTimestamp(), plan: {} };
      if (isiPlan) {
        baru.plan[planKe] = data[`plan.${planKe}`];
        delete baru[`plan.${planKe}`];
      }
      await addDoc(koleksi, baru);
      toast("Pasien ditambahkan");
    }
    tutupPanel();
  } catch (e) {
    console.error(e);
    tampilGalat($("f-pesan"), "Gagal menyimpan. Periksa sambungan dan aturan keamanan Firestore.");
  } finally {
    $("f-simpan").disabled = false;
  }
});

/* ---------- hapus ---------- */
$("f-hapus").addEventListener("click", async () => {
  if (!sedangDiedit) return;
  if (!confirm("Hapus data pasien ini secara permanen?")) return;
  try {
    await deleteDoc(doc(db, KOLEKSI_PASIEN, sedangDiedit));
    toast("Data pasien dihapus");
    tutupPanel();
  } catch (e) {
    console.error(e);
    tampilGalat($("f-pesan"), "Gagal menghapus data.");
  }
});

/* ============================================================
   BANTUAN KECIL
   ============================================================ */
function capWaktu() {
  const d = new Date();
  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][d.getDay()];
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][d.getMonth()];
  const jam = String(d.getHours()).padStart(2,"0");
  const menit = String(d.getMinutes()).padStart(2,"0");
  return `${hari}, ${d.getDate()} ${bulan} ${d.getFullYear()} ${jam}.${menit}`;
}

function tampilGalat(el, teks) {
  el.textContent = teks;
  el.hidden = false;
}

let jedaToast;
function toast(teks) {
  const t = $("toast");
  t.textContent = teks;
  t.hidden = false;
  clearTimeout(jedaToast);
  jedaToast = setTimeout(() => { t.hidden = true; }, 2600);
}
