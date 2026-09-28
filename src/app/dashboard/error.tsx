"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <main id="main" className="appreciation-page section-width"><div className="app-panel"><h1>Dashboard belum bisa dimuat.</h1><p>Coba hubungkan kembali. Tugas dan kiriman yang tersimpan di akunmu tetap ada.</p><button className="button button-blue" onClick={reset}>Coba lagi</button></div></main>;
}
