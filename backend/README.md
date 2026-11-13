# Backend DSS Prioritas Perbaikan PJU & Mitigasi Kriminalitas Dini Hari (Kecamatan Jatinangor)

Backend REST API berbasis **FastAPI (Python 3.11+)** untuk sistem pendukung keputusan (Decision Support System) penentuan prioritas perbaikan Penerangan Jalan Umum (PJU) dan mitigasi kerawanan kriminalitas dini hari pada segmen gang/zona mikro di Kecamatan Jatinangor menggunakan metode **AHP + TOPSIS**.

## Struktur Direktori

```text
backend/
├── alembic/                  # Konfigurasi migrasi database Alembic
├── app/
│   ├── api/v1/endpoints/     # 8 modul REST API endpoint (auth, users, segments, observations, ahp, topsis, map_view, worklists, history)
│   ├── core/                 # Konfigurasi env, koneksi SQLAlchemy, keamanan JWT/bcrypt
│   ├── models/               # 8 entitas tabel SQLAlchemy 2.0 (kompatibel PostgreSQL & SQLite)
│   ├── schemas/              # Skema validasi request/response Pydantic v2 & GeoJSON
│   ├── services/             # Engine AHP (NumPy), TOPSIS (NumPy), dan validator CSV (Pandas)
│   ├── main.py               # Entrypoint FastAPI + CORS
│   └── seed.py               # Seeder akun RBAC, 12 segmen Jatinangor, observasi, & bobot AHP awal
├── sample_data/
│   └── sample_jatinangor_import.csv
├── tests/
│   └── test_engines.py       # Unit & integration tests (pytest)
├── alembic.ini
├── requirements.txt
└── .env.example
```

## Cara Menjalankan Backend

1. **Masuk ke folder `backend/` dan buat virtual environment:**
   ```bash
   cd backend
   python -m venv .venv
   # Windows PowerShell:
   .venv\Scripts\Activate.ps1
   # Linux/macOS:
   # source .venv/bin/activate
   ```

2. **Install dependensi:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Siapkan konfigurasi environment:**
   ```bash
   cp .env.example .env
   ```
   > Secara default `.env.example` menggunakan SQLite lokal (`sqlite:///./dss_jatinangor.db`) untuk pengujian cepat. Untuk PostgreSQL/Supabase, ubah `DATABASE_URL` menjadi `postgresql+psycopg://user:password@host:5432/dbname`.

4. **Jalankan seeder data awal Jatinangor:**
   ```bash
   python -m app.seed
   ```

5. **Jalankan server FastAPI:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   Dokumentasi interaktif Swagger UI tersedia di `http://localhost:8000/docs`.

## Akun Default (Hasil Seeder)

| Username | Password | Role RBAC |
| :--- | :--- | :--- |
| `admin` | `admin123` | `ADMIN` |
| `operator` | `operator123` | `OPERATOR` |
| `penilai` | `penilai123` | `PENILAI` |
| `pju_lead` | `pju123` | `PENANGGUNG_JAWAB_PJU` |

## Menjalankan Pengujian (`pytest`)

```bash
pytest -v
```
