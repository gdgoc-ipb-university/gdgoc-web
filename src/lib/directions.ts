export const directions = [
  {
    id: "hello-campus",
    number: "01",
    name: "Hello, Campus!",
    subtitle: "A familiar place. A whole new world.",
    image: "/environments/01-hello-campus-ahn-cel-v2.webp",
    original: "/environments/01-hello-campus-ahn-cel-v2.png",
    alt: "Lingkungan voxel kampus IPB dengan Gedung Andi Hakim Nasoetion, pepohonan tropis, dan Chrome Dino.",
    description:
      "AHN jadi titik pulang. Dino mengajak kita menjelajahi kampus yang terasa akrab, tapi penuh kemungkinan baru.",
    mood: "Local · Warm · Playful",
    motion: "Dino menyapa, daun bergoyang pelan, kamera mengikuti pointer dengan jarak kecil.",
    colors: ["#4285f4", "#34a853", "#ba6850", "#faf9f2"],
    dark: false,
  },
  {
    id: "dino-playground",
    number: "02",
    name: "Dino Playground",
    subtitle: "Curiosity is a multiplayer game.",
    image: "/environments/02-dino-playground.webp",
    original: "/environments/02-dino-playground.png",
    alt: "Chrome Dino di taman voxel berundak dengan rumput, monitor retro, dan balok empat warna Google.",
    description:
      "Komunitas sebagai tempat bereksperimen. Taman voxel, blok warna, dan Dino yang selalu penasaran.",
    mood: "Bold · Friendly · Adventurous",
    motion:
      "Dino melompat sekali saat disapa; tiap zona dapat menjadi pintu masuk ke learning path.",
    colors: ["#34a853", "#fbbc05", "#4285f4", "#ea4335"],
    dark: false,
  },
  {
    id: "cloud-club",
    number: "03",
    name: "Cloud Club",
    subtitle: "A little space for big ideas.",
    image: "/environments/03-cloud-club.webp",
    original: "/environments/03-cloud-club.png",
    alt: "Workshop developer dengan terminal retro dan Chrome Dino di antara awan berbentuk voxel.",
    description:
      "Workshop di atas awan. Terminal retro, platform kecil, dan ruang lega untuk ide yang belum pernah dicoba.",
    mood: "Airy · Curious · Imaginative",
    motion: "Lapisan awan bergerak dengan kecepatan berbeda; terminal menyala saat didekati.",
    colors: ["#4285f4", "#dcebf4", "#34a853", "#faf9f2"],
    dark: false,
  },
  {
    id: "after-hours",
    number: "04",
    name: "After Hours",
    subtitle: "Good company. Great late-night ideas.",
    image: "/environments/04-after-hours.webp",
    original: "/environments/04-after-hours.png",
    alt: "Clubhouse developer voxel di malam hari, diterangi monitor biru dan hijau serta lampu kuning, dengan Chrome Dino.",
    description:
      "Energi build bareng setelah kelas. Ruang kerja yang hangat, cahaya monitor, dan satu ide lagi sebelum pulang.",
    mood: "Cozy · Focused · Cinematic",
    motion: "Cahaya layar bernapas lembut, satu bintang berkedip, dan Dino mengintip dari meja.",
    colors: ["#172d43", "#4285f4", "#34a853", "#fbbc05"],
    dark: true,
  },
] as const;

export type Direction = (typeof directions)[number];
