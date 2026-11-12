import { catalyst } from "./catalyst";
import { rangeLabel } from "./schedule";
import { techLeague } from "./tech-league";
import { techSupport } from "./tech-support";

/**
 * The programs /program lists: the first `flagshipCount` as "Program utama", the rest as "Program rutin". The bot API
 * (`/bot/v1/programs`) returns the same list. `id` never changes once the bot uses it; `href` is the program's page, the
 * league root for Tech League, and absent for programs announced on Instagram.
 */
export const programs: readonly { id: string; title: string; audience: string; schedule: string; href?: string }[] = [
  {
    id: "catalyst",
    title: "GDGoC Catalyst",
    audience: "Untuk siswa SMK dan mahasiswa yang ingin membangun produk dalam tim.",
    schedule: catalyst.scheduleOnHold
      ? catalyst.scheduleToFollow
      : `Pendaftaran ${rangeLabel(catalyst.oprec.opensAt, catalyst.oprec.closesAt)}. Sesi berjalan ${rangeLabel(catalyst.sessions.start, catalyst.sessions.end)}.`,
    href: catalyst.path,
  },
  {
    id: "tech-league",
    title: "Tech League",
    audience: "Untuk tim yang ingin menguji karya di kompetisi nasional.",
    schedule: `Pendaftaran ${rangeLabel(techLeague.registration.opensAt, techLeague.registration.closesAt)}.`,
    href: techLeague.href,
  },
  {
    id: "tech-support",
    title: "Tech Support",
    audience: "Untuk member yang membutuhkan mentor untuk lomba.",
    schedule: `Sepanjang tahun. Permintaan dibalas paling lama ${techSupport.responseDays} hari kerja.`,
    href: techSupport.path,
  },
  {
    id: "study-jam",
    title: "Study Jam",
    audience: "Untuk siapa pun yang ingin belajar teknologi bersama dari dasar.",
    schedule: "Terbuka untuk umum. Member yang menyelesaikan rangkaian mendapat sertifikat.",
  },
  {
    id: "google-programs",
    title: "Program Google",
    audience: "Untuk mahasiswa yang ingin mengikuti program seperti Build with AI dan JuaraGCP.",
    schedule: "Jadwal diumumkan setelah program dikonfirmasi.",
  },
  {
    id: "friday-tech-bulletin",
    title: "Friday Tech Bulletin",
    audience: "Untuk yang ingin mengikuti kabar, peluang, dan perkembangan teknologi.",
    schedule: "Info terbaru diumumkan melalui Instagram GDGoC IPB.",
  },
];

export const flagshipCount = 3;
