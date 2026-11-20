# DSS Prioritas Perbaikan PJU dan Mitigasi Kriminalitas Dini Hari

Sistem ini adalah **Decision Support System (DSS)** untuk membantu menentukan urutan prioritas perbaikan Penerangan Jalan Umum (PJU) dan mitigasi kerawanan kriminalitas dini hari pada segmen gang di Kecamatan Jatinangor. Sistem mengolah data inspeksi, menghitung bobot kepentingan kriteria menggunakan **Analytic Hierarchy Process (AHP)**, lalu menyusun peringkat segmen menggunakan **Technique for Order Preference by Similarity to Ideal Solution (TOPSIS)**.

Hasil sistem merupakan rekomendasi berbasis data untuk membantu petugas mengambil keputusan. Sistem tidak menjalankan pekerjaan perbaikan secara otomatis dan bukan alat untuk memprediksi secara pasti terjadinya tindak kriminal.

## Daftar isi

- [Tujuan dan kriteria](#tujuan-dan-kriteria)
- [Gambaran arsitektur](#gambaran-arsitektur)
- [Alur penggunaan](#alur-penggunaan)
- [Cara perhitungan AHP](#cara-perhitungan-ahp)
- [Cara perhitungan TOPSIS](#cara-perhitungan-topsis)
- [Daftar kerja dan audit](#daftar-kerja-dan-audit)
- [Modul sistem dan penyimpanan data](#modul-sistem-dan-penyimpanan-data)
- [Peran pengguna](#peran-pengguna)
- [Menjalankan aplikasi](#menjalankan-aplikasi)
- [Kondisi implementasi frontend](#kondisi-implementasi-frontend)
- [Batasan dan hal yang perlu diperhatikan](#batasan-dan-hal-yang-perlu-diperhatikan)

## Tujuan dan kriteria

Sistem membantu pengelola untuk:

1. Mendata segmen gang, lokasi, kondisi lampu, kriminalitas dini hari, dan jumlah indekos.
2. Menentukan tingkat kepentingan relatif kriteria melalui penilaian pakar AHP.
3. Menilai kelayakan data segmen dan menghitung peringkat TOPSIS.
4. Menampilkan hasil pada peta dan memberikan rincian perhitungan per segmen.
5. Mengusulkan daftar pekerjaan sesuai kuota, mencatat perubahan pilihan, dan menyimpan riwayat evaluasi.

Kriteria yang digunakan:

| Kode | Kriteria | Sumber data |
|---|---|---|
| C1 | Jumlah lampu PJU rusak | `broken_lights` |
| C2 | Jumlah kejadian curanmor dini hari | `dawn_crime_count` |
| C3 | Jumlah indekos | `boarding_house_count` |

`total_lights` juga didata untuk validasi dan ditampilkan sebagai konteks, tetapi **tidak menjadi kriteria dalam perhitungan TOPSIS**. Jadi, sistem menggunakan jumlah lampu rusak, bukan persentase lampu rusak terhadap jumlah lampu terpasang.

## Gambaran arsitektur

```text
Pengguna
   |
   v
Frontend Next.js / React
   |
   | REST API, JSON, GeoJSON
   v
Backend FastAPI / Python
   |-- Validasi data observasi dan CSV
   |-- Engine AHP
   |-- Engine TOPSIS
   |-- Autentikasi dan kontrol peran
   |
   v
Database SQLite (default) atau PostgreSQL
```

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, dan Leaflet untuk peta.
- **Backend:** FastAPI, Pydantic, SQLAlchemy, NumPy untuk perhitungan, serta Pandas untuk membaca CSV.
- **Database:** SQLite jika tidak ada konfigurasi lain; PostgreSQL dapat digunakan melalui `DATABASE_URL`.
- **API:** berawalan `/api/v1`; dokumentasi interaktif tersedia melalui Swagger UI di `/docs` ketika backend berjalan.

Backend dimulai dari `backend/app/main.py`. Engine perhitungan terdapat di [`backend/app/services/ahp_engine.py`](backend/app/services/ahp_engine.py) dan [`backend/app/services/topsis_engine.py`](backend/app/services/topsis_engine.py). Skema entitas database ada di [`backend/app/models/models.py`](backend/app/models/models.py).

## Alur penggunaan

1. **Kelola master segmen.** Petugas membuat atau memperbarui kode, nama, koridor, status aktif, dan geometri GeoJSON segmen gang.
2. **Masukkan hasil inspeksi.** Operator memasukkan data lewat formulir atau mengunggah CSV. Observasi terbaru untuk segmen yang sama menggantikan observasi sebelumnya.
3. **Periksa kualitas data.** Sistem memvalidasi angka, kode segmen, tanggal inspeksi, dan kelengkapan data. CSV ditampilkan sebagai pratinjau sebelum dikonfirmasi.
4. **Tentukan bobot kriteria.** Penilai membandingkan C1, C2, dan C3 dengan AHP. Bobot hanya dapat diaktifkan jika nilai konsistensinya memenuhi batas.
5. **Jalankan siklus TOPSIS.** Penanggung jawab PJU atau admin menjalankan pemeringkatan menggunakan bobot AHP yang aktif dan konsisten.
6. **Tinjau peta dan hasil.** Sistem menyimpan rincian normalisasi, nilai terbobot, jarak ideal, skor, peringkat, serta alasan segmen tidak layak.
7. **Tetapkan daftar kerja.** Penanggung jawab menentukan kuota, meninjau usulan sistem, lalu menetapkan pilihan final. Perubahan terhadap usulan wajib disertai alasan.
8. **Lihat riwayat dan ekspor.** Siklus, snapshot bobot, data saat perhitungan, keputusan daftar kerja, dan informasi override disimpan untuk audit.

## Cara perhitungan AHP

AHP menghasilkan bobot kepentingan untuk tiga kriteria melalui perbandingan berpasangan. Matriks harus berukuran 3×3, memiliki nilai diagonal 1, nilai positif, dan pasangan nilai resiprokal: `a_ji = 1 / a_ij`.

Contoh matriks bobot awal yang dibuat oleh seeder:

| Dibandingkan | C1 | C2 | C3 |
|---|---:|---:|---:|
| C1 | 1 | 0,5 | 2 |
| C2 | 2 | 1 | 3 |
| C3 | 0,5 | 0,3333 | 1 |

Urutan baris dan kolom adalah C1, C2, C3. Sebagai contoh, nilai `a_12 = 0,5` berarti C1 dinilai setengah sepenting C2; nilai kebalikannya `a_21 = 2`.

### Langkah menghitung bobot

1. Jumlahkan nilai pada setiap kolom.
2. Bagi setiap elemen matriks dengan jumlah kolomnya untuk memperoleh matriks ternormalisasi.
3. Ambil rata-rata nilai setiap baris sebagai bobot kriterianya.

Untuk matriks contoh, jumlah kolomnya adalah sekitar `3,5`, `1,8333`, dan `6`. Hasil bobotnya:

| Kriteria | Bobot desimal | Persentase |
|---|---:|---:|
| C1 — Lampu rusak | 0,2973 | 29,73% |
| C2 — Curanmor dini hari | 0,5390 | 53,90% |
| C3 — Indekos | 0,1638 | 16,38% |

Jumlah bobot mendekati 1. Pada contoh ini, curanmor dini hari mendapatkan bobot terbesar.

### Uji konsistensi

Sistem mengalikan matriks perbandingan dengan vektor bobot, lalu menghitung nilai lambda maksimum sebagai rata-rata dari setiap komponen `A × w` dibagi bobot kriterianya:

`lambda_max = rata-rata_i((A × w)_i / w_i)`

Indeks konsistensi dihitung dengan `CI = (lambda_max - n) / (n - 1)`, kemudian rasio konsistensi dengan `CR = CI / RI`.

Untuk tiga kriteria, sistem menggunakan `n = 3` dan `RI = 0,58`. Bobot dianggap konsisten jika `CR <= 0,10`. Matriks seeder di atas menghasilkan kurang lebih:

- `lambda_max = 3,0092`
- `CI = 0,0046`
- `CR = 0,0079`
- Status: **konsisten**

Nilai tersebut dihitung ulang oleh backend; contoh angka dibulatkan untuk dokumentasi. Versi bobot disimpan beserta matriks dan nilai uji konsistensinya. Siklus TOPSIS menggunakan versi yang aktif dan konsisten.

## Cara perhitungan TOPSIS

TOPSIS membandingkan setiap segmen layak terhadap solusi ideal terbaik dan terburuk. Perhitungan dilakukan hanya pada segmen yang memenuhi syarat kelayakan untuk siklus tersebut.

### 1. Penyaringan segmen

Segmen tidak masuk matriks TOPSIS jika:

- status segmen tidak aktif;
- belum memiliki observasi;
- tanggal inspeksi lebih lama dari batas kedaluwarsa;
- data curanmor dini hari belum diisi; atau
- jumlah lampu rusak nol atau kurang.

Batas kedaluwarsa default adalah 90 hari. Segmen yang tidak layak tetap disertakan pada hasil siklus dengan alasan, tetapi tidak memperoleh skor atau peringkat TOPSIS.

### 2. Bentuk matriks keputusan dan normalisasi

Untuk setiap segmen `i`, nilai kriterianya adalah `x_i1`, `x_i2`, dan `x_i3`. Setiap nilai dinormalisasi dengan membaginya menggunakan panjang vektor kolom:

`r_ij = x_ij / sqrt(sum_i(x_ij^2))`

Dengan demikian, perbedaan satuan/jumlah antar kriteria dapat dibandingkan. Jika norma suatu kolom bernilai nol, nilai normalisasi kolom itu ditetapkan nol.

### 3. Kalikan dengan bobot AHP

`v_ij = r_ij × w_j`

Bobot `w_j` berasal dari versi AHP aktif. Nilai `v_ij` adalah nilai ternormalisasi yang sudah mempertimbangkan kepentingan kriteria.

### 4. Tentukan solusi ideal dan hitung jarak

Secara default ketiga kriteria berarah **max**, sehingga nilai ideal positif adalah nilai terbesar dan ideal negatif adalah nilai terkecil pada setiap kolom `V`:

`A+_j = max_i(v_ij)` dan `A-_j = min_i(v_ij)`

API juga menerima arah `min` atau `max` per kriteria. Jika arahnya `min`, pemilihan ideal positif dan negatif untuk kriteria itu dibalik.

Jarak setiap segmen ke solusi positif dan negatif:

`D+_i = sqrt(sum_j((v_ij - A+_j)^2))`

`D-_i = sqrt(sum_j((v_ij - A-_j)^2))`

### 5. Skor preferensi dan peringkat

`C_i = D-_i / (D+_i + D-_i)`

Skor mendekati 1 berarti segmen lebih dekat ke ideal positif dan lebih jauh dari ideal negatif, sehingga mendapat prioritas lebih tinggi. Jika penyebut nol, implementasi memberikan skor 0. Ada perlakuan khusus jika hanya satu segmen yang layak: segmen tersebut langsung diberi skor 1 dan peringkat 1.

Peringkat ditentukan dari skor terbesar ke terkecil. Jika skor sama setelah dibulatkan enam desimal, pemecah seri berurutan adalah: kasus curanmor lebih banyak, lampu rusak lebih banyak, indekos lebih banyak, lalu kode segmen secara alfabetis.

Kategori tampilan:

| Skor | Kategori |
|---:|---|
| `C_i >= 0,66` | Tinggi |
| `0,33 <= C_i < 0,66` | Sedang |
| `C_i < 0,33` | Rendah |
| Segmen tidak layak atau tidak memiliki skor | Tidak Layak |

### Contoh hitung dari data seed

Dengan bobot awal AHP di atas, data seed memberi norma kolom TOPSIS sekitar:

`S1 = 18,1384`, `S2 = 14,3527`, dan `S3 = 57,1402`

Contoh **GG-GHN-001** memiliki data 6 lampu rusak, 7 kasus curanmor dini hari, dan 25 indekos. Normalisasi dan nilai terbobotnya kira-kira:

| Kriteria | Data x | Normalisasi r = x / S | Bobot w | Terbobot v = r × w |
|---|---:|---:|---:|---:|
| C1 — Lampu rusak | 6 | 0,3308 | 0,2973 | 0,0983 |
| C2 — Curanmor dini hari | 7 | 0,4877 | 0,5390 | 0,2629 |
| C3 — Indekos | 25 | 0,4375 | 0,1638 | 0,0717 |

Untuk semua segmen yang layak pada data seed, solusi ideal positifnya sekitar `(0,1311; 0,2629; 0,0717)`, sedangkan solusi ideal negatifnya sekitar `(0,0328; 0,0376; 0,0258)`. Maka untuk GG-GHN-001:

`D+ ≈ 0,0328`, `D- ≈ 0,2391`

`C_i ≈ 0,2391 / (0,0328 + 0,2391) = 0,8794`

Pada data seed, skor tersebut menempatkan GG-GHN-001 di peringkat pertama. Ini hanya contoh perhitungan dari data seed, bukan hasil tetap untuk data inspeksi aktual.

## Daftar kerja dan audit

Setelah pemeringkatan, pengguna memasukkan kuota kapasitas `K`. Sistem mengusulkan sampai `K` segmen eligible dengan peringkat tertinggi; segmen eligible lainnya menjadi kandidat cadangan. Pengguna dapat memilih daftar final, tetapi jumlah pilihan tidak boleh melebihi kuota dan setiap ID harus berasal dari segmen eligible pada siklus tersebut.

Jika pilihan final berbeda dari usulan Top-K, sistem menandainya sebagai **override** dan mensyaratkan alasan minimal 10 karakter. Sistem menyimpan:

- usulan awal dan pilihan final;
- kuota kapasitas;
- pengguna yang menetapkan;
- alasan override, jika ada;
- snapshot bobot dan indikator saat perhitungan.

Hasil siklus dapat dilihat kembali dan daftar kerja final dapat diekspor sebagai CSV.

## Modul sistem dan penyimpanan data

Backend mengelompokkan data ke dalam delapan entitas utama:

| Tabel | Isi |
|---|---|
| `users` | Akun, status aktif, dan peran pengguna |
| `alley_segments` | Kode, nama, koridor, geometri, dan status segmen |
| `segment_observations` | Observasi terbaru tiap segmen |
| `csv_import_batches` | Pratinjau dan status batch impor CSV |
| `ahp_weight_versions` | Matriks perbandingan, bobot, konsistensi, dan versi aktif |
| `evaluation_cycles` | Siklus TOPSIS, pelaksana, dan snapshot bobot |
| `cycle_ranking_results` | Kelayakan, snapshot data, nilai antara TOPSIS, skor, dan peringkat |
| `worklist_decisions` | Kuota, pilihan final, dan audit override |

Model database ada di [`backend/app/models/models.py`](backend/app/models/models.py). Struktur endpoint dijelaskan dalam dokumentasi backend di [`backend/README.md`](backend/README.md).

## Peran pengguna

Peran yang didefinisikan sistem:

- **ADMIN:** pengelolaan sistem dan akses administratif.
- **OPERATOR:** pendataan observasi dan impor CSV.
- **PENILAI:** membuat serta mengaktifkan versi bobot AHP yang konsisten.
- **PENANGGUNG_JAWAB_PJU:** menjalankan siklus TOPSIS dan menetapkan daftar kerja.

Endpoint backend menerapkan pembatasan peran. Akses API memerlukan login dan token bearer.

## Menjalankan aplikasi

### Prasyarat

- Python 3.11 atau lebih baru.
- Node.js dan npm.
- PowerShell pada Windows (perintah berikut memakai PowerShell).

### 1. Jalankan backend

Dari root repository:

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.db_setup
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Tanpa konfigurasi `DATABASE_URL`, backend menggunakan SQLite lokal. Untuk PostgreSQL, buat `backend/.env` dan atur `DATABASE_URL`; panduan lengkap tersedia di [`backend/README.md`](backend/README.md).

Setelah backend berjalan:

- Health check: <http://localhost:8000/health>
- Swagger UI: <http://localhost:8000/docs>
- OpenAPI JSON: <http://localhost:8000/openapi.json>

### 2. Jalankan frontend

Buka terminal PowerShell kedua dari root repository:

```powershell
Set-Location mcdm-system
npm install
npm run dev
```

Buka <http://localhost:3000>. Secara default frontend mengarah ke `http://localhost:8000/api/v1`. Jika backend berada di alamat lain, buat `mcdm-system/.env.local`:

```env
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000/api/v1
```

### Pengujian backend

Dari folder `backend` dengan virtual environment aktif:

```powershell
python -m pytest -v
```

## Kondisi implementasi frontend

Backend telah menyediakan API untuk login, segmen, observasi, impor CSV, AHP, TOPSIS, peta, daftar kerja, dan riwayat. Namun, **tidak semua layar frontend saat ini menggunakan data backend secara penuh**. Beberapa layar masih berisi contoh atau simulasi, misalnya halaman daftar kerja dan riwayat; halaman pemeringkatan juga menyediakan data mock sebagai fallback. Karena itu, angka pada layar demo bisa berbeda dari hasil perhitungan backend. Contoh implementasi dapat dilihat di [`mcdm-system/src/app/daftar-kerja/page.tsx`](mcdm-system/src/app/daftar-kerja/page.tsx), [`mcdm-system/src/app/riwayat/page.tsx`](mcdm-system/src/app/riwayat/page.tsx), dan [`mcdm-system/src/app/pemeringkatan/page.tsx`](mcdm-system/src/app/pemeringkatan/page.tsx).

Untuk hasil yang dapat diaudit, gunakan data dan hasil siklus yang disimpan oleh backend, bukan menganggap data contoh di frontend sebagai data produksi.

## Batasan dan hal yang perlu diperhatikan

1. **Arah kriteria adalah asumsi kebijakan.** Default API menganggap nilai lebih besar pada ketiga kriteria berarti lebih prioritas. Artinya, lebih banyak indekos akan menaikkan kontribusi C3 terhadap prioritas. Pastikan asumsi tersebut disepakati oleh pakar dan pemangku kepentingan.
2. **Jumlah lampu rusak adalah angka absolut.** Dua segmen dengan proporsi kerusakan berbeda dapat dibandingkan berdasarkan jumlah rusaknya, bukan persentase dari total lampu.
3. **Skor TOPSIS bersifat relatif.** Nilainya bergantung pada kriteria, bobot, dan kumpulan segmen eligible di dalam siklus. Skor dapat berubah jika data atau anggota kumpulan berubah.
4. **Kualitas hasil bergantung pada data.** Data kriminal yang belum lengkap, inspeksi yang kedaluwarsa, atau jumlah observasi yang tidak representatif dapat memengaruhi kelayakan dan peringkat.
5. **Rekomendasi perlu ditinjau manusia.** TOPSIS mengurutkan berdasarkan indikator yang dimasukkan; hasilnya bukan bukti hubungan sebab-akibat dan tidak menggantikan verifikasi lapangan.
6. **Kredensial seed hanya untuk pengembangan.** Ganti kredensial dan konfigurasi rahasia sebelum aplikasi digunakan di lingkungan produksi.
