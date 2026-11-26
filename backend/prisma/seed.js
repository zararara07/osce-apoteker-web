const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const templates = [
  ["T1", "R&D dan Studi Stabilitas", "PEMBUATAN", "res://scenes/T1_rd_stabilitas.tscn", false, false],
  ["T2", "Produksi Sediaan Farmasi", "PEMBUATAN", "res://scenes/T2_produksi.tscn", false, false],
  ["T3", "QC/QA", "PEMBUATAN", "res://scenes/T3_qc_qa.tscn", false, false],
  ["T4", "Perencanaan, Pengadaan, dan Penerimaan", "DISTRIBUSI", "res://scenes/T4_pengadaan.tscn", false, false],
  ["T5", "Penyimpanan, Penyaluran, dan Pemusnahan", "DISTRIBUSI", "res://scenes/T5_gudang.tscn", false, false],
  ["T6", "Swamedikasi", "PELAYANAN", "res://scenes/T6_swamedikasi.tscn", false, true],
  ["T7", "Skrining Resep dan DRP", "PELAYANAN", "res://scenes/T7_drp.tscn", false, true],
  ["T8", "Compounding Steril dan Non-steril", "PELAYANAN", "res://scenes/T8_compounding.tscn", false, false],
  ["T9", "Dispensing, KIE, Monitoring, dan MESO", "PELAYANAN", "res://scenes/T9_kie_meso.tscn", false, true],
  ["T10", "Ruang Istirahat", "ISTIRAHAT", "res://scenes/T10_istirahat.tscn", true, false],
];

const dayPlans = {
  1: [
    ["Edukasi pasien", "T9", "Serahkan obat sesuai resep dan lakukan edukasi pasien sesuai kasus."],
    ["Pemusnahan obat", "T5", "Kelompokkan obat yang akan dimusnahkan dan lengkapi dokumen sesuai skenario."],
    ["Swamedikasi", "T6", "Gali informasi keluhan pasien, tentukan kebutuhan tindak lanjut, dan berikan informasi obat."],
    ["Analisis HPLC", "T3", "Analisis data kromatografi, hitung kadar, lalu interpretasikan hasil terhadap spesifikasi."],
    ["Istirahat", "T10", "Silakan beristirahat sampai waktu station berakhir."],
    ["Studi stabilitas", "T1", "Lengkapi worksheet stabilitas. Worksheet kedua menunggu persetujuan penguji."],
    ["Rekonstitusi sirup kering", "T8", "Hitung volume pelarut dan lakukan rekonstitusi sesuai petunjuk pada kemasan."],
    ["Rencana kebutuhan obat", "T4", "Hitung kebutuhan pengadaan dan pilih pemasok yang memenuhi syarat."],
    ["Uji disolusi", "T3", "Interpretasikan data disolusi dan dokumentasikan kesimpulan mutu."],
    ["Skrining resep dan DRP", "T7", "Skrining resep, identifikasi masalah terkait obat, dan susun rekomendasi."],
  ],
  2: [
    ["Visite rawat inap", "T7", "Tinjau data pasien dan terapi, identifikasi DRP, dan susun rekomendasi."],
    ["Compounding", "T8", "Siapkan alat dan bahan, lakukan peracikan, lalu lengkapi etiket dan dokumentasi."],
    ["Konseling pasien", "T9", "Lakukan konseling dan pastikan pasien memahami cara penggunaan obat."],
    ["Perhitungan kadar spektrofotometri", "T3", "Gunakan kurva kalibrasi untuk menghitung dan menginterpretasikan kadar."],
    ["Istirahat", "T10", "Silakan beristirahat sampai waktu station berakhir."],
    ["Reorder point dan Surat Pesanan", "T4", "Hitung reorder point dan lengkapi Surat Pesanan sesuai skenario."],
    ["Produksi injeksi steril", "T2", "Lakukan simulasi persiapan produksi injeksi dengan teknik aseptis."],
    ["Rekonstitusi meropenem", "T8", "Hitung konsentrasi dan volume pelarut, lalu susun langkah rekonstitusi aseptis."],
    ["Swamedikasi ibu hamil", "T6", "Gali informasi pasien, pertimbangkan kondisi kehamilan, lalu berikan edukasi atau rujukan."],
    ["Klasifikasi limbah medis", "T5", "Pilah item ke kategori limbah yang sesuai dengan skenario."],
  ],
  3: [
    ["Pemusnahan obat rusak dan kedaluwarsa", "T5", "Pisahkan produk rusak atau kedaluwarsa, tempatkan pada area sesuai, dan lengkapi berita acara."],
    ["Susut pengeringan (LOD)", "T3", "Hitung persen susut pengeringan dan simpulkan hasil berdasarkan spesifikasi yang tersedia."],
    ["KIE pasien konstipasi", "T9", "Gali keluhan dan riwayat obat pasien, berikan edukasi, serta tentukan kebutuhan rujukan."],
    ["Peracikan obat epilepsi anak", "T8", "Hitung kebutuhan dosis dari data resep dan berat badan, lalu dokumentasikan peracikan."],
    ["Istirahat", "T10", "Silakan beristirahat sampai waktu station berakhir."],
    ["Perhitungan RKO", "T4", "Hitung kebutuhan obat berdasarkan data pemakaian, stok, lead time, dan safety stock."],
    ["Perhitungan faktor F", "T3", "Hitung faktor pengenceran atau koreksi berdasarkan data yang tersedia."],
    ["DRP pasien stroke", "T7", "Tinjau terapi pasien dan cara pemberian melalui NGT, lalu komunikasikan rekomendasi."],
    ["MESO", "T9", "Nilai dugaan efek samping, dokumentasikan MESO, dan susun rekomendasi monitoring."],
  ],
};

async function main() {
  const templateByCode = {};
  for (const [code, name, area, scenePath, isRestRoom, defaultHasMic] of templates) {
    templateByCode[code] = await prisma.template.upsert({
      where: { code },
      update: { name, area, scenePath, isRestRoom, defaultHasMic },
      create: { code, name, area, scenePath, isRestRoom, defaultHasMic },
    });
  }

  for (const dayNumber of [1, 2, 3]) {
    const examDay = await prisma.examDay.upsert({
      where: { dayNumber },
      update: { title: `Paket Ujian Day ${dayNumber}`, isActive: true },
      create: { dayNumber, title: `Paket Ujian Day ${dayNumber}`, isActive: true },
    });

    for (const [index, [title, templateCode, doorInstructionText]] of dayPlans[dayNumber].entries()) {
      const stationNumber = index + 1;
      const template = templateByCode[templateCode];
      await prisma.stationCase.upsert({
        where: { examDayId_stationNumber: { examDayId: examDay.id, stationNumber } },
        update: {
          templateId: template.id,
          title,
          doorInstructionText,
          hasMicrophone: template.defaultHasMic,
          requiresAccStage: templateCode === "T1",
          readSeconds: 60,
          workSeconds: 540,
          moveSeconds: 60,
        },
        create: {
          examDayId: examDay.id,
          stationNumber,
          templateId: template.id,
          title,
          doorInstructionText,
          hasMicrophone: template.defaultHasMic,
          requiresAccStage: templateCode === "T1",
          readSeconds: 60,
          workSeconds: 540,
          moveSeconds: 60,
          caseDataJson: { formCodes: [] },
        },
      });
    }
  }

  const dayOne = await prisma.examDay.findUnique({ where: { dayNumber: 1 } });
  const swamedikasi = await prisma.stationCase.findUnique({ where: { examDayId_stationNumber: { examDayId: dayOne.id, stationNumber: 3 } } });
  await prisma.npcDialogNode.deleteMany({ where: { stationCaseId: swamedikasi.id } });
  await prisma.npcDialogNode.createMany({ data: [
    { stationCaseId: swamedikasi.id, npcRole: "PASIEN", triggerKeywords: ["hamil", "menyusui"], isHiddenClue: true, clueKey: "CLUE_KEHAMILAN", responseText: "Ya, saya sedang hamil. Apakah obat ini aman untuk saya?", rubricCode: "TANYA_KEHAMILAN" },
    { stationCaseId: swamedikasi.id, npcRole: "PASIEN", triggerKeywords: ["alergi"], isHiddenClue: true, clueKey: "CLUE_ALERGI", responseText: "Saya pernah mengalami reaksi alergi terhadap obat tertentu.", rubricCode: "TANYA_ALERGI" },
    { stationCaseId: swamedikasi.id, npcRole: "PASIEN", triggerKeywords: [], isHiddenClue: false, responseText: "Saya merasa pusing dan agak meriang sejak kemarin sore. Sebaiknya bagaimana?" },
  ] });

  console.log("Seed selesai: template T1–T10, Day 1–2 lengkap, Day 3 menunggu soal Station 10.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
