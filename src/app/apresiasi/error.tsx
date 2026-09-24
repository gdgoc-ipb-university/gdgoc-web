"use client";

export default function AppreciationError({ reset }: { reset: () => void }) {
  return <main id="main" className="appreciation-page section-width"><div className="app-panel"><h1>Halaman belum bisa dimuat.</h1><p>Coba hubungkan kembali. Perubahan yang tersimpan di akunmu tetap ada.</p><button className="button button-blue" onClick={reset}>Coba lagi</button></div></main>;
}
