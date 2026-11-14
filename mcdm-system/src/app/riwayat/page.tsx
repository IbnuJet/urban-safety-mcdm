import Link from "next/link";

export default function RiwayatPage() {
  return (
    <div className="p-8 bg-[#F7F8F5] min-h-full">
      {/* Header Halaman */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
          Riwayat siklus evaluasi
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Daftar riwayat siklus kerja perbaikan PJU yang telah ditetapkan sebelumnya.
        </p>
      </div>

      {/* Placeholder Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-xs max-w-2xl">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#edf4f0] text-[#1a5b3e] flex items-center justify-center font-bold text-sm shrink-0">
            ✓
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              Siklus November 2026 Berhasil Ditetapkan
            </h2>
            <p className="text-xs text-zinc-500">
              3 segmen prioritas (Gang Ciseke 01, Gang Caringin 01, Gang H. Nena 01)
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed mb-6">
          Halaman riwayat lengkap sedang dalam tahap pengembangan (isi menyusul). Data siklus ini telah tersimpan dan siap diekspor ke format CSV sesuai spesifikasi API.
        </p>

        <div className="flex items-center gap-3">
          <Link
            href="/daftar-kerja"
            className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition"
          >
            &larr; Kembali ke Daftar Kerja
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-[#1a5b3e] hover:bg-[#164d34] text-white text-xs font-medium transition shadow-xs"
          >
            Ke Peta Prioritas &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
