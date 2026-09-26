"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="onboard-loading"><h1>Perkenalanmu belum bisa dibuka.</h1><p>Langkah yang sudah tersimpan tetap ada. Periksa koneksi dan coba lagi.</p><button className="button button-blue" onClick={reset}>Coba lagi</button></main>;
}
