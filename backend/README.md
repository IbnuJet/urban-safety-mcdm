# Backend DSS Prioritas Perbaikan PJU & Mitigasi Kriminalitas Dini Hari (Kecamatan Jatinangor)

Backend REST API berbasis **FastAPI (Python 3.11+)** untuk sistem pendukung keputusan (Decision Support System) penentuan prioritas perbaikan Penerangan Jalan Umum (PJU) dan mitigasi kerawanan kriminalitas dini hari pada segmen gang/zona mikro di Kecamatan Jatinangor menggunakan metode **AHP + TOPSIS**.

---

## Struktur Direktori

```text
backend/
├── alembic/                  # Konfigurasi migrasi database Alembic
├── app/
│   ├── api/v1/endpoints/     # 8 modul REST API (auth, users, segments, observations, ahp, topsis, map_view, worklists, history)
│   ├── core/                 # Konfigurasi env, koneksi SQLAlchemy, keamanan JWT/bcrypt
│   ├── models/               # 8 entitas tabel SQLAlchemy 2.0 (kompatibel PostgreSQL & SQLite)
│   ├── schemas/              # Skema validasi request/response Pydantic v2 & GeoJSON
│   ├── services/             # Engine AHP (NumPy), TOPSIS (NumPy), dan validator CSV (Pandas)
│   ├── db_setup.py           # Utilitas verifikasi koneksi DB, init skema, seed, & cek row count
│   ├── main.py               # Entrypoint FastAPI + CORS
│   └── seed.py               # Seeder akun RBAC, 12 segmen Jatinangor, observasi, & bobot AHP awal
├── sample_data/
│   └── sample_jatinangor_import.csv
├── scripts/
│   └── setup_postgres.ps1    # Skrip otomatis setup PostgreSQL + .env di Windows PowerShell
├── tests/
│   └── test_engines.py       # Unit & integration tests (pytest)
├── alembic.ini
├── requirements.txt
├── API_Documentation_DSS_Jatinangor.pdf
└── .env.example
```

---

## Setup Database PostgreSQL (Direkomendasikan untuk Staging/Produksi)

> Catatan: Secara default tanpa file `.env`, aplikasi memakai SQLite lokal (`sqlite:///./dss_jatinangor.db`). Untuk beralih ke **PostgreSQL**, ikuti salah satu metode di bawah ini.

### Opsi A — Setup Otomatis (Windows PowerShell)

Pastikan service PostgreSQL (mis. `postgresql-x64-18`) sudah berjalan di port `5432`, lalu jalankan dari folder `backend/`:

```powershell
cd backend
.\scripts\setup_postgres.ps1
```

Atau langsung menyertakan parameter password:

```powershell
.\scripts\setup_postgres.ps1 -PgPassword "PASSWORD_POSTGRES_ANDA"
```

Skrip ini akan otomatis:
1. Mengecek dan membuat database `dss_jatinangor` lewat `psql` jika belum ada.
2. Membuat/memperbarui `backend/.env` dengan `DATABASE_URL="postgresql+psycopg://postgres:...@localhost:5432/dss_jatinangor"`.
3. Menjalankan `python -m app.db_setup` untuk membuat 8 tabel, mengisi data seed awal, dan menampilkan jumlah baris tiap tabel.

---

### Opsi B — Setup Manual Langkah demi Langkah

1. **Buat database PostgreSQL:**
   ```powershell
   psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE dss_jatinangor;"
   ```
   *(Atau buat database `dss_jatinangor` melalui pgAdmin 4 / DBeaver / Supabase Dashboard).*

2. **Buat dan konfigurasi `backend/.env`:**
   ```powershell
   cd backend
   Copy-Item .env.example .env
   ```
   Edit `backend/.env` dan ubah `DATABASE_URL` menjadi kredensial PostgreSQL Anda (driver `psycopg` v3 sudah terpasang di `requirements.txt`):
   ```env
   # Contoh PostgreSQL Lokal:
   DATABASE_URL="postgresql+psycopg://postgres:PASSWORD_ANDA@localhost:5432/dss_jatinangor"

   # Contoh Supabase PostgreSQL:
   # DATABASE_URL="postgresql+psycopg://postgres.PROJECT_REF:PASSWORD_ANDA@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   ```
   > **Tips karakter spesial password:** Jika password mengandung karakter seperti `@`, `#`, `:`, atau `/`, lakukan URL-encoding (mis. `@` menjadi `%40`) pada string `DATABASE_URL`.

3. **Pastikan environment Python aktif dan dependensi terpasang:**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

4. **Inisialisasi skema, seed data awal, dan verifikasi koneksi:**
   ```powershell
   python -m app.db_setup
   ```
   Contoh output sukses:
   ```text
   [DB Setup] Target dialect : postgresql
   [DB Setup] Target URL     : postgresql+psycopg://postgres:***@localhost:5432/dss_jatinangor
   [DB Setup] Skema 8 tabel berhasil dipastikan ada (init_db).
   [DB Setup] Seeder idempotent selesai dijalankan.

   [DB Setup] Ringkasan jumlah baris per tabel:
     - users                    : 4
     - alley_segments           : 12
     - segment_observations     : 12
     - ahp_weight_versions      : 1
     - csv_import_batches       : 0
     - evaluation_cycles        : 0
     - cycle_ranking_results    : 0
     - worklist_decisions       : 0
   ```

5. **(Opsional) Menggunakan Migrasi Alembic:**
   Konfigurasi `alembic/env.py` otomatis membaca `DATABASE_URL` dari `.env`:
   ```powershell
   alembic revision --autogenerate -m "initial_schema"
   alembic upgrade head
   ```

6. **Verifikasi langsung lewat `psql`:**
   ```powershell
   psql -U postgres -h localhost -d dss_jatinangor -c "\dt"
   psql -U postgres -h localhost -d dss_jatinangor -c "SELECT id, username, email, role FROM users;"
   psql -U postgres -h localhost -d dss_jatinangor -c "SELECT segment_code, name, corridor FROM alley_segments ORDER BY id;"
   ```

### Daftar 8 Tabel Database

| Tabel | Fungsi |
| :--- | :--- |
| `users` | Akun pengguna RBAC (`ADMIN`, `OPERATOR`, `PENILAI`, `PENANGGUNG_JAWAB_PJU`) |
| `alley_segments` | Master 12+ segmen gang Jatinangor + geometri GeoJSON batas segmen |
| `segment_observations` | Data kondisi lapangan terkini tiap segmen (lampu mati, curanmor, indekos, tanggal inspeksi) |
| `csv_import_batches` | Audit & preview staging import CSV sebelum konfirmasi |
| `ahp_weight_versions` | Riwayat matriks Saaty, bobot $W_1, W_2, W_3$, Consistency Ratio ($CR \le 0.10$), & status aktif |
| `evaluation_cycles` | Riwayat eksekusi siklus TOPSIS beserta snapshot bobot |
| `cycle_ranking_results` | Hasil normalisasi, matriks terbobot, $D^+$, $D^-$, skor preferensi $V_i$, peringkat, & alasan ineligibel |
| `worklist_decisions` | Keputusan daftar kerja final, kuota kapasitas $K$, flag override, & audit alasan perubahan |

### Troubleshooting Koneksi PostgreSQL

- **`fe_sendauth: no password supplied` / `password authentication failed`**: Pastikan password PostgreSQL diisi pada `DATABASE_URL` di `backend/.env` dan sesuai dengan user PostgreSQL (`postgres`).
- **`database "dss_jatinangor" does not exist`**: Jalankan `CREATE DATABASE dss_jatinangor;` terlebih dahulu lewat `psql` atau pgAdmin, atau jalankan `.\scripts\setup_postgres.ps1`.
- **`connection refused` pada port `5432`**: Pastikan service Windows `postgresql-x64-18` berstatus *Running* (`Get-Service *postgres*`).

---

## Mode Cepat SQLite (Pengembangan Lokal)

Jika tidak membuat file `.env` (atau menyetel `DATABASE_URL="sqlite:///./dss_jatinangor.db"`), backend memakai file SQLite lokal:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.db_setup
.\.venv\Scripts\uvicorn.exe app.main:app --reload --host 0.0.0.0 --port 8000
```

Dokumentasi interaktif tersedia di:
- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
- PDF Dokumentasi API: `backend/API_Documentation_DSS_Jatinangor.pdf`

---

## Akun Default (Hasil Seeder)

Login (`POST /api/v1/auth/login`) mendukung **Email** maupun **Username** (selaras dengan layar Figma `00 · Masuk`):

| Username | Email | Password | Role RBAC |
| :--- | :--- | :--- | :--- |
| `admin` | `admin@jatinangor-dss.id` | `admin123` | `ADMIN` |
| `operator` | `operator@jatinangor-dss.id` | `operator123` | `OPERATOR` |
| `penilai` | `penilai@jatinangor-dss.id` | `penilai123` | `PENILAI` |
| `pju_lead` | `pju.lead@jatinangor-dss.id` | `pju123` | `PENANGGUNG_JAWAB_PJU` |

---

## Pemetaan Desain Figma (`DSS Jatinangor — Prioritas PJU`) ke Endpoint API

Seluruh 23 layar pada desain Figma telah dipetakan ke endpoint `/api/v1`:

| Layar Figma | Fitur UI | Endpoint Backend |
| :--- | :--- | :--- |
| `00 · Masuk` | Login dengan Email/Username + Kata sandi, info profil aktif | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` |
| `01 · Peta prioritas`, `01b · Filter koridor` | 4 kartu KPI (`summary`), layer GeoJSON peta prioritas, filter koridor, panel detail kalkulasi segmen | `GET /api/v1/map/priority-layer`, `GET /api/v1/map/segments/{segment_id}/detail` |
| `02`, `02b · Tambah`, `02c · Edit segmen` | Tabel segmen (`has_geometry`, `last_inspection_date`), cari & filter koridor, tambah/ubah segmen GeoJSON | `GET /api/v1/segments`, `GET /api/v1/segments/{segment_id}`, `POST /api/v1/segments`, `PUT /api/v1/segments/{segment_id}` |
| `03 · Pendataan`, `03b · Preview CSV`, `03c · Konfirmasi CSV` | Ringkasan validasi sidebar, unduh templat CSV, input form manual, unggah/pratinjau/ganti CSV, konfirmasi simpan batch | `GET /api/v1/observations/validation-summary`, `GET /api/v1/observations/csv-template`, `POST /api/v1/observations/form`, `POST /api/v1/observations/upload-csv`, `GET /api/v1/observations/batches/{batch_id}`, `DELETE /api/v1/observations/batches/{batch_id}`, `POST /api/v1/observations/batches/{batch_id}/confirm` |
| `04 · Pembobotan AHP`, `04b · Simpan versi` | Kalkulasi pratinjau via `saaty_comparisons` (3 slider Saaty 1–9) atau `pairwise_matrix`, simpan versi & aktivasi ($CR \le 0.10$) | `POST /api/v1/ahp/calculate-preview`, `GET /api/v1/ahp/versions`, `POST /api/v1/ahp/versions`, `PATCH /api/v1/ahp/versions/{version_id}/activate` |
| `05 · Pemeringkatan TOPSIS` | Jalankan hitung ulang siklus TOPSIS, ambil siklus terbaru atau berdasarkan ID | `POST /api/v1/topsis/cycles`, `GET /api/v1/topsis/cycles/latest`, `GET /api/v1/topsis/cycles/{cycle_id}` |
| `06 · Daftar kerja`, `06b · Override alasan` | Simulasi usulan kuota $K$ (usulan + cadangan), finalisasi daftar kerja + audit wajib alasan override ($\ge 10$ karakter) | `POST /api/v1/worklists/cycles/{cycle_id}/propose`, `POST /api/v1/worklists/cycles/{cycle_id}/finalize`, `GET /api/v1/worklists/cycles/{cycle_id}` |
| `07 · Riwayat`, `07b · Detail`, `07c · Disesuaikan` | Daftar riwayat siklus, detail lengkap siklus + daftar segmen terpilih vs tergantikan, unduh CSV hasil | `GET /api/v1/history/cycles`, `GET /api/v1/history/cycles/{cycle_id}`, `GET /api/v1/history/cycles/{cycle_id}/export-csv` |
| `08 · Akun & akses`, `08b · Edit akses` | Manajemen akun pengguna, ubah role/status aktif/reset password | `GET /api/v1/users`, `POST /api/v1/users`, `PATCH /api/v1/users/{user_id}` |

---

## Menjalankan Pengujian (`pytest`)

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```
