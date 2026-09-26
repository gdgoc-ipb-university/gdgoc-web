// Search suggestions, not an exhaustive registry. Both fields accept unlisted values.
// Sources and the review date are recorded in docs/ONBOARDING.md.
export type EducationOption = { name: string; keywords?: string };
export const campusOptions: EducationOption[] = [
  { name: "IPB University", keywords: "Institut Pertanian Bogor IPB" },
  { name: "Universitas Pakuan", keywords: "UNPAK Bogor" },
  { name: "Universitas Ibn Khaldun Bogor", keywords: "UIKA" },
  { name: "Universitas Djuanda", keywords: "UNIDA Bogor" },
];

export const studyProgramOptions: EducationOption[] = [
  "Ilmu Komputer", "Teknologi Rekayasa Perangkat Lunak", "Manajemen", "Akuntansi",
  "Bisnis Digital", "Ilmu Komunikasi", "Biologi", "Kimia", "Matematika", "Farmasi",
  "Teknik Sipil", "Teknik Elektro", "Teknik Geologi", "Teknik Geodesi",
  "Perencanaan Wilayah dan Kota", "Pendidikan Biologi", "Pendidikan Guru Sekolah Dasar",
  "Pendidikan Bahasa Inggris", "Sastra Indonesia", "Sastra Inggris", "Sastra Jepang",
  "Statistika dan Sains Data", "Aktuaria", "Kecerdasan Buatan", "Bioinformatika",
  "Komunikasi Digital dan Media", "Teknologi Rekayasa Komputer", "Ekowisata",
  "Manajemen Sumberdaya Lahan", "Agronomi dan Hortikultura", "Proteksi Tanaman", "Arsitektur Lanskap",
  "Smart Agriculture", "Teknologi dan Manajemen Perikanan Budidaya", "Manajemen Sumberdaya Perairan",
  "Teknologi Hasil Perairan", "Teknologi dan Manajemen Perikanan Tangkap", "Ilmu dan Teknologi Kelautan",
  "Teknologi Produksi Ternak", "Nutrisi dan Teknologi Pakan", "Teknologi Hasil Ternak", "Manajemen Hutan",
  "Teknologi Hasil Hutan", "Konservasi Sumberdaya Hutan dan Ekowisata", "Silvikultur",
  "Teknik Pertanian dan Biosistem", "Teknologi Pangan", "Teknik Industri Pertanian", "Teknik Sipil dan Lingkungan",
  "Teknik Mesin", "Teknik Kimia", "Meteorologi Terapan", "Fisika", "Biokimia", "Ekonomi Pembangunan",
  "Agribisnis", "Ekonomi Sumberdaya dan Lingkungan", "Ilmu Ekonomi Syariah", "Ilmu Keluarga dan Konsumen",
  "Komunikasi dan Pengembangan Masyarakat", "Kedokteran", "Ilmu Gizi", "Bisnis", "Kedokteran Hewan", "Sains Biomedis",
].map((name) => ({ name }));
