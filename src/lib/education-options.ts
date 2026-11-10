// Search suggestions, not an exhaustive registry. Both fields accept unlisted values.
// Sources and the review date are recorded in docs/ONBOARDING.md.
export type EducationOption = {
  /** The value saved on the profile and shown in the input. Unique within a list. */
  name: string;
  /** Extra search terms (abbreviations, old names) that are not shown. */
  keywords?: string;
  /** A second line in the list, e.g. the city, to tell same-named schools apart. */
  detail?: string;
};

/** Bogor campuses, listed first and kept under their familiar names; the national list skips their registry names. */
export const campusOptions: EducationOption[] = [
  { name: "IPB University", keywords: "Institut Pertanian Bogor IPB Dramaga", detail: "Kab. Bogor" },
  { name: "Universitas Pakuan", keywords: "UNPAK Bogor", detail: "Kota Bogor" },
  { name: "Universitas Ibn Khaldun Bogor", keywords: "UIKA", detail: "Kota Bogor" },
  { name: "Universitas Djuanda", keywords: "UNIDA Bogor", detail: "Kab. Bogor" },
];
/** Registry names of the campuses above, so the national list does not repeat them under a second name. */
export const curatedCampusAliases = ["Institut Pertanian Bogor", "Universitas Pakuan", "Universitas Ibn Khaldun Bogor", "Universitas Djuanda"];

export const studyProgramOptions: EducationOption[] = [
  "Ilmu Komputer", "Informatika", "Teknik Informatika", "Sistem Informasi", "Teknologi Informasi", "Sains Data", "Desain Komunikasi Visual",
  "Teknologi Rekayasa Perangkat Lunak", "Manajemen", "Akuntansi",
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

/**
 * SMK majors (konsentrasi keahlian), with the older names students still use (TKJ, RPL, Multimedia, OTKP) as search
 * terms. A starting list for the technology-adjacent majors most likely to join, not the full spectrum.
 */
export const schoolProgramOptions: EducationOption[] = [
  { name: "Rekayasa Perangkat Lunak", keywords: "RPL PPLG Pengembangan Perangkat Lunak dan Gim programming" },
  { name: "Pengembangan Gim", keywords: "PPLG game developer" },
  { name: "Teknik Komputer dan Jaringan", keywords: "TKJ TJKT jaringan" },
  { name: "Sistem Informatika, Jaringan, dan Aplikasi", keywords: "SIJA" },
  { name: "Teknik Jaringan Akses Telekomunikasi", keywords: "TJAT TJKT telekomunikasi" },
  { name: "Desain Komunikasi Visual", keywords: "DKV Multimedia MM desain grafis" },
  { name: "Multimedia", keywords: "MM DKV" },
  { name: "Animasi", keywords: "animation" },
  { name: "Broadcasting dan Perfilman", keywords: "Produksi dan Siaran Program Televisi PSPT film" },
  { name: "Desain Grafika", keywords: "grafika percetakan" },
  { name: "Teknik Elektronika Industri", keywords: "TEI elektronika" },
  { name: "Teknik Otomasi Industri", keywords: "TOI otomasi" },
  { name: "Teknik Mekatronika", keywords: "mekatronika" },
  { name: "Teknik Instalasi Tenaga Listrik", keywords: "TITL ketenagalistrikan" },
  { name: "Teknik Kendaraan Ringan", keywords: "TKR otomotif" },
  { name: "Teknik Sepeda Motor", keywords: "TSM otomotif TBSM" },
  { name: "Teknik Pemesinan", keywords: "TPM mesin" },
  { name: "Akuntansi dan Keuangan Lembaga", keywords: "AKL akuntansi" },
  { name: "Manajemen Perkantoran dan Layanan Bisnis", keywords: "MPLB OTKP perkantoran administrasi" },
  { name: "Bisnis Digital", keywords: "pemasaran BD BDP" },
  { name: "Bisnis Retail", keywords: "pemasaran" },
  { name: "Usaha Layanan Pariwisata", keywords: "ULP pariwisata" },
  { name: "Perhotelan", keywords: "hotel" },
  { name: "Kuliner", keywords: "tata boga" },
  { name: "Desain dan Produksi Busana", keywords: "tata busana" },
  { name: "Tata Kecantikan Kulit dan Rambut", keywords: "kecantikan" },
  { name: "Farmasi Klinis dan Komunitas", keywords: "farmasi" },
  { name: "Layanan Kesehatan", keywords: "keperawatan asisten" },
  { name: "Agribisnis Tanaman Pangan dan Hortikultura", keywords: "ATPH agribisnis" },
  { name: "Agribisnis Ternak", keywords: "peternakan" },
];

/** Lower case, accents and punctuation removed, so "SMK N 1" finds "SMKN 1". */
const fold = (text: string) => text.toLocaleLowerCase("id-ID").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const squash = (text: string) => text.replace(/ /g, "");

/**
 * The options that match what was typed, best first: a name that starts with it, then a word that starts with it,
 * then any match in the name, keywords or detail. Options listed earlier win ties, so curated Bogor entries come first.
 * At most `limit` results, so a list of thousands stays quick to render on a phone.
 */
export function searchEducation(options: EducationOption[], query: string, limit = 50): EducationOption[] {
  const q = fold(query);
  if (!q) return options.slice(0, limit);
  const compact = squash(q);
  const scored: { option: EducationOption; score: number; index: number }[] = [];
  options.forEach((option, index) => {
    const name = fold(option.name);
    let score = -1;
    if (name.startsWith(q) || squash(name).startsWith(compact)) score = 0;
    else if (` ${name}`.includes(` ${q}`)) score = 1;
    else if (name.includes(q) || squash(name).includes(compact)) score = 2;
    else {
      const extra = fold(`${option.keywords ?? ""} ${option.detail ?? ""}`);
      if (` ${extra}`.includes(` ${q}`) || squash(extra).includes(compact)) score = 3;
    }
    if (score >= 0) scored.push({ option, score, index });
  });
  scored.sort((a, b) => a.score - b.score || a.index - b.index);
  return scored.slice(0, limit).map((entry) => entry.option);
}

/** [name, detail] rows, as stored in the generated lists. */
type Row = [string, string];
const toOptions = (rows: Row[]) => rows.map(([name, detail]) => ({ name, detail }));

/**
 * Every campus in the national registry (universities, institutes, polytechnics, colleges and academies) after the
 * Bogor ones. Loaded on demand: the list is too long to ship with the page.
 */
export async function loadCampusOptions(): Promise<EducationOption[]> {
  const rows = (await import("./institutions/campuses.json")).default as Row[];
  const skip = new Set(curatedCampusAliases.map(fold));
  return [...campusOptions, ...toOptions(rows).filter((option) => !skip.has(fold(option.name)))];
}

/** SMKs and MAKs in West Java, Jakarta and Banten, Bogor first. Loaded on demand. */
export async function loadSchoolOptions(): Promise<EducationOption[]> {
  return toOptions((await import("./institutions/schools.json")).default as Row[]);
}
