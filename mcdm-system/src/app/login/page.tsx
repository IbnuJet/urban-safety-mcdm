"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithCredentials, loginWithRole } from "./actions";
import { SEEDER_ACCOUNTS, UserRole } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Email atau username wajib diisi.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await loginWithCredentials(identifier, password);
      if (!res.success) {
        setError(res.message || "Gagal masuk ke sistem.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan saat memproses login.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePrototypeLogin(role: UserRole) {
    const acc = SEEDER_ACCOUNTS.find((a) => a.role === role);
    if (acc) {
      setIdentifier(acc.email);
      setPassword(acc.password);
    }

    setLoading(true);
    setError(null);
    try {
      const res = await loginWithRole(role);
      if (!res.success) {
        setError(res.message || "Gagal masuk sebagai prototipe.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan koneksi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#F7F8F5] text-zinc-900 flex items-center justify-center p-6 selection:bg-[#1a5b3e]/20 selection:text-[#1a5b3e]">
      <div className="w-[430px] rounded-2xl bg-white border border-[#e5e7eb]/80 p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)] transition-all">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#185D47] flex items-center justify-center text-white shrink-0 shadow-xs">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">\
              <path d="M7 21V8a5 5 0 0 1 5-5h2a3 3 0 0 1 3 3v2"/>
              <path d="M14 8h6l-1.5 3.5h-3z"/>
              <line x1="16" y1="15" x2="15" y2="17"/>
              <line x1="18.5" y1="15" x2="18.5" y2="18"/>
              <line x1="21" y1="15" x2="22" y2="17"/>
            </svg>
          </div>

          <div>
            <h2 className="text-[15px] font-bold text-zinc-900 leading-tight tracking-tight">DSS Jatinangor</h2>
            <p className="text-[12px] text-zinc-500 leading-tight mt-0.5">Penerangan jalan umum</p>
          </div>
        </div>

        <div className="h-px bg-zinc-100 my-5" />

        <div className="mb-5">
          <h1 className="text-[26px] font-bold text-zinc-900 tracking-tight leading-tight">Masuk</h1>
          <p className="text-[13px] text-zinc-500 mt-1 leading-normal">Gunakan akun yang telah diberikan admin.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200/80 text-red-700 text-xs flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="identifier" className="block text-[13px] font-medium text-zinc-800 mb-1.5">Email</label>
            <input id="identifier" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="nama@instansi.go.id" disabled={loading}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] focus:border-[#1a5b3e] transition bg-white disabled:bg-zinc-50"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[13px] font-medium text-zinc-800 mb-1.5">Kata sandi</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan kata sandi" disabled={loading}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#1a5b3e] focus:border-[#1a5b3e] transition bg-white disabled:bg-zinc-50"
            />
          </div>

          <button type="submit" disabled={loading} className="w-full mt-2 py-2.5 px-4 bg-[#185D47] hover:bg-[#164d34] active:bg-[#123e2a] disabled:opacity-70 text-white font-medium text-[14px] rounded-lg transition-colors cursor-pointer flex items-center justify-center shadow-xs">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Memproses...
              </span>
            ) : (
              "Masuk"
            )}
          </button>
        </form>

        <div className="mt-6">
          <p className="text-[12px] text-zinc-400 mb-2.5 font-normal">Coba prototipe sebagai</p>
          <div className="space-y-2">
            <button type="button" disabled={loading} onClick={() => handlePrototypeLogin("PENILAI")}
              className="w-full px-4 py-2.5 rounded-lg bg-[#F2F7F2] hover:bg-[#e2ece5] active:bg-[#d7e5db] text-[#185D47] text-[13px] font-medium flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span>Penilai kriteria</span>
              <svg className="w-4 h-4 text-[#185D47] transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>

            <button type="button" disabled={loading} onClick={() => handlePrototypeLogin("PENANGGUNG_JAWAB_PJU")}
              className="w-full px-4 py-2.5 rounded-lg bg-[#F2F7F2] hover:bg-[#e2ece5] active:bg-[#d7e5db] text-[#185D47] text-[13px] font-medium flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span>Penanggung jawab PJU</span>
              <svg className="w-4 h-4 text-[#185D47] transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>

            <button type="button" disabled={loading} onClick={() => handlePrototypeLogin("ADMIN")}
              className="w-full px-4 py-2.5 rounded-lg bg-[#F2F7F2] hover:bg-[#e2ece5] active:bg-[#d7e5db] text-[#185D47] text-[13px] font-medium flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span>Admin sistem</span>
              <svg className="w-4 h-4 text-[#185D47] transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}