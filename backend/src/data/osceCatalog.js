// ============================================================================
// KATALOG DATA-DRIVEN OSCE UKMPPAI (LAMPIRAN A, B, C, D, F)
// 10 Template Ruangan melayani Paket Ujian Day 1, Day 2, dan Day 3
// ============================================================================

const TEMPLATES = {
  T1: { code: "T1", name: "Pembuatan 1: R&D & Studi Stabilitas", area: "PEMBUATAN", scenePath: "res://scenes/T1_rd_stabilitas.tscn", isRestRoom: false, defaultHasMic: false },
  T2: { code: "T2", name: "Pembuatan 2: Produksi Sediaan Farmasi", area: "PEMBUATAN", scenePath: "res://scenes/T2_produksi.tscn", isRestRoom: false, defaultHasMic: false },
  T3: { code: "T3", name: "Pembuatan 3: QC/QA Lab Industri", area: "PEMBUATAN", scenePath: "res://scenes/T3_qc_qa.tscn", isRestRoom: false, defaultHasMic: false },
  T4: { code: "T4", name: "Distribusi 1: Perencanaan & Pengadaan", area: "DISTRIBUSI", scenePath: "res://scenes/T4_pengadaan.tscn", isRestRoom: false, defaultHasMic: false },
  T5: { code: "T5", name: "Distribusi 2: Penyimpanan & Pemusnahan", area: "DISTRIBUSI", scenePath: "res://scenes/T5_pemusnahan.tscn", isRestRoom: false, defaultHasMic: false },
  T6: { code: "T6", name: "Pelayanan 1: Swamedikasi (Apotek)", area: "PELAYANAN", scenePath: "res://scenes/T6_swamedikasi.tscn", isRestRoom: false, defaultHasMic: true },
  T7: { code: "T7", name: "Pelayanan 2: Skrining Resep & DRP", area: "PELAYANAN", scenePath: "res://scenes/T7_skrining_drp.tscn", isRestRoom: false, defaultHasMic: true },
  T8: { code: "T8", name: "Pelayanan 3: Compounding Steril & Non-Steril", area: "PELAYANAN", scenePath: "res://scenes/T8_compounding.tscn", isRestRoom: false, defaultHasMic: false },
  T9: { code: "T9", name: "Pelayanan 4: Dispensing (KIE), Monev & MESO", area: "PELAYANAN", scenePath: "res://scenes/T9_konseling_meso.tscn", isRestRoom: false, defaultHasMic: true },
  T10: { code: "T10", name: "Ruang Istirahat", area: "ISTIRAHAT", scenePath: "res://scenes/T10_istirahat.tscn", isRestRoom: true, defaultHasMic: false },
};

const REFERENCE_LIBRARY = {
  ISO: { code: "ISO", title: "ISO Indonesia", summary: "Informasi Spesialite Obat: komposisi, indikasi, dosis, golongan, dan bentuk sediaan." },
  MIMS: { code: "MIMS", title: "MIMS Petunjuk Konsultasi", summary: "Referensi dosis dewasa/anak, kontraindikasi, efek samping, dan kategori kehamilan." },
  DIPIRO: { code: "DIPIRO", title: "DiPiro Pharmacotherapy", summary: "Pedoman terapi klinis berbasis bukti untuk hipertensi, DM, stroke, infeksi, dan konstipasi." },
  STOCKLEY: { code: "STOCKLEY", title: "Stockley's Drug Interactions", summary: "Cek interaksi obat mayor/moderat (contoh: antikoagulan + laksatif/AINS)." },
  BUKU_KIA: { code: "BUKU_KIA", title: "Buku KIA & Keamanan Obat Ibu Hamil", summary: "Panduan kategori keamanan obat ibu hamil/menyusui (Parasetamol aman; AINS hindari trimester 3)." },
  FI_V: { code: "FI_V", title: "Farmakope Indonesia Edisi V", summary: "Persyaratan mutu sediaan: kadar, uji disolusi (nilai Q), susut pengeringan (LOD), dan sterilitas." },
  CPOB: { code: "CPOB", title: "Pedoman CPOB & ICH Q1A(R2)", summary: "Kondisi uji stabilitas zona IVb: Long term 30°C/75% RH, Accelerated 40°C/75% RH." },
  PMK_3: { code: "PMK_3", title: "PMK No. 3 Tahun 2015", summary: "Peredaran, penyimpanan, pemusnahan, dan pelaporan Narkotika, Psikotropika, & Prekursor beserta saksi wajib." },
  LIMBAH_B3: { code: "LIMBAH_B3", title: "Regulasi Limbah Medis B3", summary: "Kuning: infeksius, Cokelat: farmasi/kimia, Ungu: sitotoksik, Merah: radioaktif, Hitam: domestik, Safety box: benda tajam." },
  CDOB: { code: "CDOB", title: "Pedoman CDOB & Fornas", summary: "Kualifikasi pemasok PBF (izin PBF + sertifikat CDOB), perhitungan RKO, ROP, dan safety stock." },
};

const makeStation = (
  stationNumber,
  templateCode,
  title,
  doorInstruction,
  {
    items = [],
    allowedReferences = ["ISO", "MIMS"],
    forms = ["WORKSHEET_UMUM"],
    requiresAccStage = false,
    npcClues = [],
    interactiveActions = ["WASH_HANDS", "WEAR_APD"],
  } = {}
) => {
  const tpl = TEMPLATES[templateCode];
  return {
    stationNumber,
    templateCode,
    template: tpl,
    title,
    isRestStation: tpl.isRestRoom,
    hasMicrophone: tpl.defaultHasMic,
    requiresAccStage,
    doorInstruction,
    items,
    allowedReferences: allowedReferences.map((code) => REFERENCE_LIBRARY[code]).filter(Boolean),
    forms,
    npcClues,
    interactiveActions,
  };
};

// Pemetaan Lengkap Lampiran F (Day 1, Day 2, Day 3)
const EXAM_DAYS = {
  1: {
    dayNumber: 1,
    title: "Paket Ujian Day 1",
    subtitle: "9 Station Kasus UKAI + Station 5 Istirahat",
    stations: [
      makeStation(1, "T9", "Edukasi Pasien (KIE)", "Lakukan konseling & KIE kepada pasien rawat jalan mengenai cara penggunaan obat dan pencegahan DRP.", {
        items: [{ slotId: "desk_1", name: "Ventolin Inhaler MDI", drugClass: "KERAS", condition: "GOOD", expDate: "2028-02" }],
        allowedReferences: ["ISO", "MIMS", "DIPIRO"],
        forms: ["FORM_KIE_PIO"],
        npcClues: [
          { clueKey: "CLUE_TEKNIK_INHALER", keywords: ["cara pakai", "inhaler", "hisap", "kocok", "kumur"], reply: "Saya sering bingung, apakah inhaler ini perlu dikocok dulu dan habis pakai harus berkumur?" },
          { clueKey: "CLUE_ALERGI", keywords: ["alergi", "riwayat"], reply: "Saya tidak ada alergi obat, tapi sering sesak saat malam hari." },
        ],
        interactiveActions: ["WASH_HANDS", "CHECK_PATIENT_ID", "DEMO_INHALER"],
      }),
      makeStation(2, "T5", "Pemusnahan Obat", "Identifikasi obat ED dan belum ED, pisahkan ke area karantina, pilih saksi sesuai regulasi, dan lengkapi Berita Acara Pemusnahan.", {
        items: [
          { slotId: "shelf_A1", name: "Amoksisilin Kaplet 500 mg", drugClass: "KERAS", condition: "EXPIRED", expDate: "2024-06" },
          { slotId: "shelf_A2", name: "Parasetamol 500 mg", drugClass: "BEBAS", condition: "GOOD", expDate: "2028-05" },
        ],
        allowedReferences: ["PMK_3", "LIMBAH_B3"],
        forms: ["BERITA_ACARA_PEMUSNAHAN"],
        interactiveActions: ["WASH_HANDS", "WEAR_APD", "SORT_QUARANTINE"],
      }),
      makeStation(3, "T6", "Swamedikasi", "Pasien datang ke apotek mengeluh nyeri dan demam. Gali informasi pasien, pilih obat sesuai golongan regulasi, dan berikan PIO lengkap.", {
        items: [
          { slotId: "rack_A1", name: "Parasetamol 500 mg (Sanmol)", drugClass: "BEBAS", condition: "GOOD", expDate: "2028-04" },
          { slotId: "rack_A2", name: "Ibuprofen 400 mg", drugClass: "BEBAS_TERBATAS", condition: "GOOD", expDate: "2028-01" },
          { slotId: "rack_K1", name: "Asam Mefenamat 500 mg (Pengecoh)", drugClass: "KERAS", condition: "GOOD", isDistractor: true },
        ],
        allowedReferences: ["ISO", "MIMS", "BUKU_KIA"],
        forms: ["FORM_SWAMEDIKASI_PIO"],
        npcClues: [
          { clueKey: "CLUE_HAMIL_MENYUSUI", keywords: ["hamil", "menyusui", "kandungan", "bayi"], reply: "Oh iya apoteker, saya sedang hamil 5 bulan. Apakah obatnya aman untuk janin?" },
          { clueKey: "CLUE_ALERGI", keywords: ["alergi", "maag", "lambung"], reply: "Saya tidak ada alergi, tapi lambung saya agak sensitif." },
        ],
        interactiveActions: ["WASH_HANDS", "CHECK_DRUG_CLASS"],
      }),
      makeStation(4, "T3", "Analisis HPLC", "Analisis kromatogram hasil HPLC, hitung kadar sampel (% label claim), dan tentukan apakah memenuhi spesifikasi Farmakope.", {
        items: [{ slotId: "lab_1", name: "Sampel Tablet Uji HPLC", drugClass: "KERAS", condition: "GOOD", batchNo: "BCH-2026-01" }],
        allowedReferences: ["FI_V", "CPOB"],
        forms: ["WORKSHEET_QC_HPLC"],
        interactiveActions: ["WASH_HANDS", "WEAR_APD", "INSPECT_HPLC"],
      }),
      makeStation(5, "T10", "Ruang Istirahat", "Station 5 adalah Ruang Istirahat. Tidak ada soal pada station ini. Tarik napas dan bersiap untuk Station 6.", {
        allowedReferences: [],
        forms: [],
        interactiveActions: [],
      }),
      makeStation(6, "T1", "Studi Stabilitas (Alur ACC)", "Lengkapi Worksheet 1 (produk, batch, kondisi climatic chamber), minta ACC Penguji terlebih dahulu, lalu selesaikan Worksheet 2 perkiraan umur simpan.", {
        items: [{ slotId: "chamber_1", name: "Produk Uji Stabilitas Zona IVb", drugClass: "KERAS", condition: "GOOD", batchNo: "STB-09" }],
        allowedReferences: ["FI_V", "CPOB"],
        forms: ["WORKSHEET_STABILITAS_1_2"],
        requiresAccStage: true,
        interactiveActions: ["WASH_HANDS", "WEAR_APD", "CHECK_CLIMATIC_CHAMBER"],
      }),
      makeStation(7, "T8", "Rekonstitusi Sirup Kering", "Hitung dosis, lakukan rekonstitusi sirup kering Amoksisilin hingga garis batas pelarut, buat etiket putih + label BUD, dan berikan PIO.", {
        items: [{ slotId: "table_1", name: "Amoksisilin Sirup Kering 125 mg/5 mL", drugClass: "KERAS", condition: "GOOD", expDate: "2028-09" }],
        allowedReferences: ["ISO", "MIMS"],
        forms: ["FORM_COMPOUNDING_ETIKET"],
        interactiveActions: ["WASH_HANDS", "WEAR_APD", "RECONSTITUTE_LINE"],
      }),
      makeStation(8, "T4", "Perencanaan RKO", "Analisis data pemakaian 1 tahun, hitung safety stock & jumlah pesan, serta pilih PBF yang memenuhi kualifikasi CDOB.", {
        items: [{ slotId: "gudang_1", name: "Data Pemakaian 12 Bulan & Daftar PBF", drugClass: "BEBAS", condition: "GOOD" }],
        allowedReferences: ["CDOB"],
        forms: ["FORM_RKO_SP"],
        interactiveActions: ["CHECK_PBF_ELIGIBILITY"],
      }),
      makeStation(9, "T3", "Uji Disolusi", "Evaluasi persen terlarut pada 6 vessel (nilai Q tahap S1/S2), tetapkan keputusan lulus/karantina/tolak dan tindak lanjut reformulasi.", {
        items: [{ slotId: "lab_2", name: "Vessel Disolusi S1 (6 Sampel)", drugClass: "KERAS", condition: "GOOD" }],
        allowedReferences: ["FI_V", "CPOB"],
        forms: ["WORKSHEET_QC_DISOLUSI"],
        interactiveActions: ["WASH_HANDS", "WEAR_APD", "INSPECT_DISSOLUTION"],
      }),
      makeStation(10, "T7", "Skrining Resep & DRP", "Lakukan skrining 3 aspek, temukan interaksi obat pada resep pasien, diskusikan rekomendasi pengganti kepada dokter DPJP, dan dokumentasikan.", {
        items: [{ slotId: "trolley_1", name: "Resep Pasien Polifarmasi", drugClass: "KERAS", condition: "GOOD" }],
        allowedReferences: ["ISO", "MIMS", "STOCKLEY"],
        forms: ["FORM_SKRINING_DRP"],
        npcClues: [
          { clueKey: "CLUE_INTERAKSI_DPJP", keywords: ["interaksi", "ganti", "rekomendasi", "dokter", "dosis"], reply: "Baik apoteker, terima kasih atas temuan interaksinya. Obat alternatif apa yang Anda rekomendasikan?" },
        ],
        interactiveActions: ["WASH_HANDS", "CHECK_PATIENT_ID", "OPEN_INTERACTION_CHECKER"],
      }),
    ],
  },

  2: {
    dayNumber: 2,
    title: "Paket Ujian Day 2",
    subtitle: "9 Station Kasus UKAI + Station 5 Istirahat",
    stations: [
      makeStation(1, "T7", "Visite Rawat Inap (Cek DRP)", "Tinjau rekam medis CPPT/MAR pasien rawat inap, identifikasi DRP, dan komunikasikan rekomendasi terapi.", {
        allowedReferences: ["ISO", "MIMS", "DIPIRO", "STOCKLEY"],
        forms: ["FORM_SKRINING_DRP"],
        npcClues: [
          { clueKey: "CLUE_LAB_GINJAL", keywords: ["ginjal", "kreatinin", "lab", "dosis"], reply: "Nilai kreatinin pasien meningkat sejak kemarin, mohon evaluasi penyesuaian dosisnya." },
        ],
        interactiveActions: ["WASH_HANDS", "CHECK_PATIENT_ID"],
      }),
      makeStation(2, "T8", "Compounding Salep", "Hitung bahan, lakukan peracikan salep non-steril, kemas dalam pot salep, dan tempelkan etiket biru obat luar.", {
        allowedReferences: ["ISO", "FI_V"],
        forms: ["FORM_COMPOUNDING_ETIKET"],
        interactiveActions: ["WASH_HANDS", "WEAR_APD", "WEIGH_MATERIAL"],
      }),
      makeStation(3, "T9", "Konseling Pasien", "Berikan konseling mendalam terkait kepatuhan minum obat, efek samping, dan pastikan pasien memahami instruksi (teach-back).", {
        allowedReferences: ["ISO", "MIMS", "DIPIRO"],
        forms: ["FORM_KIE_PIO"],
        npcClues: [
          { clueKey: "CLUE_TIDAK_PATUH", keywords: ["rutin", "lupa", "berhenti", "paham", "ulang"], reply: "Kadang saya berhenti minum obat kalau badan sudah terasa enakan, apoteker." },
        ],
        interactiveActions: ["WASH_HANDS", "CHECK_PATIENT_ID"],
      }),
      makeStation(4, "T3", "Hitung Kadar dari Hasil Spektro", "Baca kurva kalibrasi spektrofotometer UV-Vis, hitung kadar obat, dan simpulkan kesesuaiannya.", {
        allowedReferences: ["FI_V"],
        forms: ["WORKSHEET_QC_SPEKTRO"],
        interactiveActions: ["WASH_HANDS", "WEAR_APD"],
      }),
      makeStation(5, "T10", "Ruang Istirahat", "Station 5 adalah Ruang Istirahat. Tidak ada soal pada station ini.", {
        allowedReferences: [],
        forms: [],
        interactiveActions: [],
      }),
      makeStation(6, "T4", "Reorder Point & Surat Pesanan", "Hitung Reorder Point (ROP) dan buat Surat Pesanan sesuai golongan obat.", {
        allowedReferences: ["CDOB", "PMK_3"],
        forms: ["FORM_RKO_SP"],
        interactiveActions: ["VERIFY_SP_TYPE"],
      }),
      makeStation(7, "T2", "Injeksi Steril Aseptis (Industri)", "Kenakan APD steril secara berurutan, siapkan area LAF, dan lakukan pembuatan injeksi steril aseptis.", {
        allowedReferences: ["CPOB", "FI_V"],
        forms: ["CHECKLIST_ASEPTIS_BATCH"],
        interactiveActions: ["WASH_HANDS", "WEAR_STERILE_APD_ORDER", "OPERATE_LAF"],
      }),
      makeStation(8, "T8", "Rekonstitusi Meropenem (RS)", "Hitung volume pelarut & konsentrasi Meropenem IV di dalam LAF/BSC secara aseptis serta tetapkan BUD.", {
        allowedReferences: ["ISO", "FI_V"],
        forms: ["CHECKLIST_ASEPTIS_BATCH"],
        interactiveActions: ["WASH_HANDS", "WEAR_STERILE_APD_ORDER", "OPERATE_LAF"],
      }),
      makeStation(9, "T6", "Swamedikasi Ibu Hamil", "Layani pasien yang mengeluh batuk/pilek di apotek. Gali kondisi khusus pasien dan pilih obat yang aman.", {
        items: [
          { slotId: "rack_A1", name: "Parasetamol 500 mg", drugClass: "BEBAS", condition: "GOOD" },
          { slotId: "rack_K1", name: "Dekongestan Kombinasi (Perhatian Hamil)", drugClass: "BEBAS_TERBATAS", condition: "GOOD", isDistractor: true },
        ],
        allowedReferences: ["ISO", "MIMS", "BUKU_KIA"],
        forms: ["FORM_SWAMEDIKASI_PIO"],
        npcClues: [
          { clueKey: "CLUE_HAMIL", keywords: ["hamil", "trimester", "kandungan", "usia kehamilan"], reply: "Saya sedang hamil trimester pertama (10 minggu), apoteker." },
        ],
        interactiveActions: ["WASH_HANDS", "CHECK_DRUG_CLASS"],
      }),
      makeStation(10, "T5", "Klasifikasi Limbah Medis", "Klasifikasikan limbah obat ED, sisa sitostatika, kasa berdarah, dan spuit bekas ke kantong warna & safety box yang tepat.", {
        items: [
          { slotId: "waste_1", name: "Sisa Vial Doksorubisin (Sitostatika)", drugClass: "SITOSTATIKA", condition: "EXPIRED" },
          { slotId: "waste_2", name: "Kasa Berdarah (Infeksius)", drugClass: "HERBAL_ALKES", condition: "DAMAGED" },
          { slotId: "waste_3", name: "Tablet Kedaluwarsa (Farmasi)", drugClass: "KERAS", condition: "EXPIRED" },
        ],
        allowedReferences: ["LIMBAH_B3"],
        forms: ["FORM_KLASIFIKASI_LIMBAH"],
        interactiveActions: ["WASH_HANDS", "WEAR_APD", "SORT_WASTE_BINS"],
      }),
    ],
  },

  3: {
    dayNumber: 3,
    title: "Paket Ujian Day 3",
    subtitle: "9 Station Kasus UKAI (S10 Placeholder Dosen) + Station 5 Istirahat",
    stations: [
      makeStation(1, "T5", "Pemusnahan Obat Rusak & ED", "Pilah Parasetamol (rusak), Ventolin (baik), Hidrokortison (ED), dan Sanmol sirup (bocor), susun di rak karantina, dan isi Berita Acara.", {
        items: [
          { slotId: "shelf_A1", name: "Parasetamol Tablet", drugClass: "BEBAS", condition: "DAMAGED", expDate: "2027-05" },
          { slotId: "shelf_A2", name: "Ventolin Inhaler", drugClass: "KERAS", condition: "GOOD", expDate: "2028-03" },
          { slotId: "shelf_A3", name: "Hidrokortison Krim", drugClass: "KERAS", condition: "EXPIRED", expDate: "2024-08" },
          { slotId: "shelf_A4", name: "Sanmol Sirup", drugClass: "BEBAS", condition: "LEAKING", expDate: "2027-10" },
        ],
        allowedReferences: ["PMK_3", "LIMBAH_B3"],
        forms: ["BERITA_ACARA_PEMUSNAHAN"],
        interactiveActions: ["WASH_HANDS", "WEAR_APD", "SORT_QUARANTINE"],
      }),
      makeStation(2, "T3", "Susut Pengeringan (LOD)", "Lakukan penimbangan awal, pemanasan oven, timbang akhir, hitung % LOD, dan simpulkan kelayakan sampel.", {
        allowedReferences: ["FI_V"],
        forms: ["WORKSHEET_QC_LOD"],
        interactiveActions: ["WASH_HANDS", "WEAR_APD", "OPERATE_OVEN_LOD"],
      }),
      makeStation(3, "T9", "KIE Pasien Konstipasi", "Pasien laki-laki konstipasi yang memakai antikoagulan. Gali riwayat BAB & obat lain, pilih laksatif tepat (Microlax/Bisakodil/Laxadine), dan edukasi non-farmakologi.", {
        items: [
          { slotId: "desk_1", name: "Microlax Enema", drugClass: "BEBAS", condition: "GOOD" },
          { slotId: "desk_2", name: "Bisakodil Supositoria", drugClass: "BEBAS_TERBATAS", condition: "GOOD" },
          { slotId: "desk_3", name: "Laxadine Emulsi", drugClass: "BEBAS_TERBATAS", condition: "GOOD" },
        ],
        allowedReferences: ["ISO", "MIMS", "DIPIRO", "STOCKLEY"],
        forms: ["FORM_KIE_PIO"],
        npcClues: [
          { clueKey: "CLUE_ANTIKOAGULAN", keywords: ["obat lain", "rutin", "jantung", "pengencer", "antikoagulan", "warfarin"], reply: "Saya rutin minum obat pengencer darah (warfarin) dari dokter jantung, apoteker." },
          { clueKey: "CLUE_ALARM_BAB", keywords: ["darah", "lama", "berapa hari", "nyeri"], reply: "Sudah 4 hari susah BAB, tapi tidak ada darah pada tinja." },
        ],
        interactiveActions: ["WASH_HANDS", "CHECK_PATIENT_ID"],
      }),
      makeStation(4, "T8", "Peracikan Obat Epilepsi Anak", "Pasien anak BB 15 kg, dosis 1 mg/kgBB, Topamax 25 mg tablet (m.f. pulv. dtd. No. LX, S t.d.d. pulv. I). Hitung tablet, pengencer, racik puyer & buat etiket.", {
        items: [{ slotId: "table_1", name: "Topamax (Topiramat) 25 mg", drugClass: "KERAS", condition: "GOOD" }],
        allowedReferences: ["ISO", "MIMS"],
        forms: ["FORM_COMPOUNDING_ETIKET"],
        interactiveActions: ["WASH_HANDS", "WEAR_APD", "WEIGH_MATERIAL"],
      }),
      makeStation(5, "T10", "Ruang Istirahat", "Station 5 adalah Ruang Istirahat. Tidak ada soal pada station ini.", {
        allowedReferences: [],
        forms: [],
        interactiveActions: [],
      }),
      makeStation(6, "T4", "Perhitungan RKO (Captopril & Amlodipin)", "Hitung kebutuhan, safety stock, dan jumlah pemesanan RKO untuk Captopril dan Amlodipin.", {
        allowedReferences: ["CDOB"],
        forms: ["FORM_RKO_SP"],
        interactiveActions: ["CHECK_PBF_ELIGIBILITY"],
      }),
      makeStation(7, "T3", "Perhitungan Faktor (F)", "Hitung faktor pengenceran (F) dan faktor koreksi baku pembanding pada analisis lab.", {
        allowedReferences: ["FI_V"],
        forms: ["WORKSHEET_QC_FAKTOR"],
        interactiveActions: ["WASH_HANDS"],
      }),
      makeStation(8, "T7", "DRP Pasien Stroke (NGT)", "Pasien stroke terpasang selang NGT mendapat Nifedipin OROS dan Nikardipin IV. Identifikasi DRP (OROS tidak boleh digerus!) dan rekomendasikan ke dokter.", {
        items: [
          { slotId: "trolley_1", name: "Nifedipin OROS 30 mg (Lepas Lambat)", drugClass: "KERAS", condition: "GOOD" },
          { slotId: "trolley_2", name: "Nikardipin Injeksi IV", drugClass: "KERAS", condition: "GOOD" },
        ],
        allowedReferences: ["ISO", "MIMS", "DIPIRO"],
        forms: ["FORM_SKRINING_DRP"],
        npcClues: [
          { clueKey: "CLUE_NGT_OROS", keywords: ["gerus", "ngt", "selang", "lepas lambat", "oros", "ganti"], reply: "Betul apoteker, pasien kesulitan menelan sehingga memakai NGT. Apakah Nifedipin OROS tidak boleh digerus?" },
        ],
        interactiveActions: ["WASH_HANDS", "CHECK_PATIENT_ID", "INSPECT_NGT"],
      }),
      makeStation(9, "T9", "MESO Kemoterapi", "Pasien kanker payudara (Doksorubisin + 5-FU) mengeluh lemas, pucat, pusing 2 minggu. Evaluasi algoritma Naranjo, isi form MESO & monitoring Hb/jantung.", {
        items: [
          { slotId: "desk_1", name: "Doksorubisin + 5-FU (Regimen Kemo)", drugClass: "SITOSTATIKA", condition: "GOOD" },
        ],
        allowedReferences: ["ISO", "DIPIRO"],
        forms: ["FORM_MESO_NARANJO"],
        npcClues: [
          { clueKey: "CLUE_GEJALA_ANEMIA", keywords: ["lemas", "pucat", "pusing", "kapan", "lab", "hb"], reply: "Keluhan lemas dan pucat mulai terasa 2 minggu setelah siklus kemoterapi kedua." },
        ],
        interactiveActions: ["WASH_HANDS", "CHECK_PATIENT_ID"],
      }),
      makeStation(10, "T7", "Station 10 (Menunggu Soal Final Dosen)", "Placeholder Day 3 Station 10 sesuai catatan Lampiran F. Siap diperbarui lewat CMS Dosen segera setelah soal diterima.", {
        allowedReferences: ["ISO", "MIMS"],
        forms: ["WORKSHEET_UMUM"],
        interactiveActions: ["WASH_HANDS"],
      }),
    ],
  },
};

module.exports = { TEMPLATES, REFERENCE_LIBRARY, EXAM_DAYS };
