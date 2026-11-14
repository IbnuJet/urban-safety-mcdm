import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { ROLE_LABELS, UserSession } from "../lib/auth";
import { logoutAction } from "./login/actions";

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6 text-zinc-500">
      <div className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-xl border border-zinc-200/80 shadow-xs">
        <svg className="animate-spin h-5 w-5 text-[#1a5b3e]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <span className="text-sm font-medium text-zinc-700">Memuat sesi DSS Jatinangor...</span>
      </div>
    </div>
  );
}

async function DashboardContent() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("auth_session");
  let session: UserSession | null = null;
  if (sessionCookie?.value) {
    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      session = null;
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] flex flex-col items-center justify-center p-6 text-zinc-900">
        <div className="w-[460px] bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-center">
          <div className="w-12 h-12 rounded-xl bg-[#1a5b3e] flex items-center justify-center text-white mx-auto mb-4 shadow-sm">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 21V8a5 5 0 0 1 5-5h2a3 3 0 0 1 3 3v2"/>
              <path d="M14 8h6l-1.5 3.5h-3z"/>
              <line x1="16" y1="15" x2="15" y2="17"/>
              <line x1="18.5" y1="15" x2="18.5" y2="18"/>
              <line x1="21" y1="15" x2="22" y2="17"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">DSS Jatinangor</h1>
          <p className="text-sm text-zinc-500 mt-1 mb-6">Sistem Pendukung Keputusan Prioritas Penerangan Jalan Umum (PJU) & Keselamatan Dini Hari</p>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs mb-6 text-left">Anda belum masuk ke dalam sistem. Silakan masuk menggunakan akun instansi atau coba prototipe role.</div>
          <Link href="/login" className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-[#1a5b3e] hover:bg-[#164d34] text-white font-medium text-sm rounded-lg transition-colors shadow-sm">
            Masuk ke Halaman Login &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const { user } = session;
  const roleDisplay = ROLE_LABELS[user.role] || user.role;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-zinc-900">
      <header className="bg-white border-b border-zinc-200/80 px-8 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1a5b3e] flex items-center justify-center text-white shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 21V8a5 5 0 0 1 5-5h2a3 3 0 0 1 3 3v2"/>
              <path d="M14 8h6l-1.5 3.5h-3z"/>
              <line x1="16" y1="15" x2="15" y2="17"/>
              <line x1="18.5" y1="15" x2="18.5" y2="18"/>
              <line x1="21" y1="15" x2="22" y2="17"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-900 leading-tight">DSS Jatinangor</h1>
            <p className="text-[11px] text-zinc-500 leading-tight">Penerangan jalan umum & Keselamatan Dini Hari</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-zinc-900">{user.full_name || user.username}</p>
            <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[#edf4f0] text-[#1a5b3e] font-medium">{roleDisplay}</span>
          </div>

          <form action={logoutAction}>
            <button type="submit" className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer">
              Keluar
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-8">
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs mb-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block px-2.5 py-1 rounded-md bg-[#edf4f0] text-[#1a5b3e] text-xs font-medium mb-2">Sesi Aktif: {roleDisplay}</span>
              <h2 className="text-xl font-bold text-zinc-900">Selamat Datang, {user.full_name}</h2>
              <p className="text-sm text-zinc-600 mt-1 max-w-2xl">
                {user.role === "PENILAI" &&
                  "Anda memiliki hak akses untuk melakukan penilaian perbandingan berpasangan (AHP), pembobotan kriteria keselamatan, dan evaluasi titik lokasi PJU Jatinangor."}
                {user.role === "PENANGGUNG_JAWAB_PJU" &&
                  "Anda memiliki akses untuk memonitoring laporan kondisi fisik PJU, meninjau hasil peringkat prioritas penanganan (TOPSIS), dan menyetujui rekomendasi daftar kerja (worklist)."}
                {user.role === "ADMIN" &&
                  "Anda memiliki hak akses administratif penuh untuk mengelola data master kriteria, data ruas gang/segmen Jatinangor, akun pengguna, dan konfigurasi metode MCDM."}
                {user.role === "OPERATOR" &&
                  "Anda memiliki akses untuk melakukan input observasi lapangan kondisi PJU serta upload file data survei CSV."}
              </p>
            </div>
            <Link href="/login" className="text-xs text-[#1a5b3e] hover:underline flex items-center gap-1 font-medium">Ganti Akun &rarr;</Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-xl border border-zinc-200/80 hover:border-[#1a5b3e]/40 transition">
            <div className="w-8 h-8 rounded-lg bg-[#edf4f0] text-[#1a5b3e] flex items-center justify-center font-bold text-xs mb-3">01</div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">Pembobotan AHP</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">Penetapan tingkat kepentingan kriteria: Kerusakan Lampu (C1), Curanmor Dini Hari (C2), dan Kepadatan Indekos (C3).</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-zinc-200/80 hover:border-[#1a5b3e]/40 transition">
            <div className="w-8 h-8 rounded-lg bg-[#edf4f0] text-[#1a5b3e] flex items-center justify-center font-bold text-xs mb-3">02</div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">Data Segmen Gang & PJU</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">Koridor Ciseke, Caringin, Gang H Nena, Hegarmanah, dan Sukawening dengan layer spasial GeoJSON.</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-zinc-200/80 hover:border-[#1a5b3e]/40 transition">
            <div className="w-8 h-8 rounded-lg bg-[#edf4f0] text-[#1a5b3e] flex items-center justify-center font-bold text-xs mb-3">03</div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">Perangkingan TOPSIS</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">Perhitungan nilai preferensi segmen gang untuk penetapan prioritas daftar kerja perbaikan lampu jalan.</p>
          </div>
        </div>
      </main>
    </div>
  );
}