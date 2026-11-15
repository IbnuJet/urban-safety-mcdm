<#
.SYNOPSIS
    Setup database PostgreSQL lokal untuk Backend DSS Prioritas PJU Jatinangor.
.EXAMPLE
    .\scripts\setup_postgres.ps1 -PgPassword "password_postgres_anda"
#>
param(
    [string]$PgHost = "localhost",
    [int]$PgPort = 5432,
    [string]$PgUser = "postgres",
    [string]$PgDatabase = "dss_jatinangor",
    [string]$PgPassword = ""
)

$ErrorActionPreference = "Stop"

$BackendDir = Split-Path -Parent $PSScriptRoot
Set-Location $BackendDir

if ([string]::IsNullOrWhiteSpace($PgPassword)) {
    $SecurePwd = Read-Host "Masukkan password PostgreSQL untuk user '$PgUser'" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePwd)
    $PgPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

$PsqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $PsqlPath)) {
    $PsqlCmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -eq $PsqlCmd) {
        throw "psql.exe tidak ditemukan. Pastikan PostgreSQL 18 (atau psql CLI) terpasang."
    }
    $PsqlPath = $PsqlCmd.Source
}

Write-Host "[1/4] Mengecek dan membuat database '$PgDatabase' jika belum ada..." -ForegroundColor Cyan
$env:PGPASSWORD = $PgPassword
try {
    $Exists = & $PsqlPath -h $PgHost -p $PgPort -U $PgUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$PgDatabase'"
    if ($LASTEXITCODE -ne 0) {
        throw "Gagal terhubung ke PostgreSQL. Periksa host, port, username, dan password."
    }
    if ($Exists.Trim() -ne "1") {
        & $PsqlPath -h $PgHost -p $PgPort -U $PgUser -d postgres -c "CREATE DATABASE $PgDatabase;"
        if ($LASTEXITCODE -ne 0) {
            throw "Gagal membuat database '$PgDatabase'."
        }
        Write-Host "      Database '$PgDatabase' berhasil dibuat." -ForegroundColor Green
    }
    else {
        Write-Host "      Database '$PgDatabase' sudah tersedia." -ForegroundColor Yellow
    }
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "[2/4] Menyusun file backend/.env ..." -ForegroundColor Cyan
$EnvPath = Join-Path $BackendDir ".env"
$EnvExamplePath = Join-Path $BackendDir ".env.example"
if (-not (Test-Path $EnvPath)) {
    Copy-Item $EnvExamplePath $EnvPath
}

$EscapedPassword = [System.Uri]::EscapeDataString($PgPassword)
$DatabaseUrl = "postgresql+psycopg://${PgUser}:${EscapedPassword}@${PgHost}:${PgPort}/${PgDatabase}"

$EnvLines = Get-Content $EnvPath
$Updated = $false
$NewLines = foreach ($Line in $EnvLines) {
    if ($Line -match "^DATABASE_URL=") {
        $Updated = $true
        "DATABASE_URL=`"$DatabaseUrl`""
    }
    else {
        $Line
    }
}
if (-not $Updated) {
    $NewLines += "DATABASE_URL=`"$DatabaseUrl`""
}
Set-Content -Path $EnvPath -Value $NewLines -Encoding UTF8
Write-Host "      DATABASE_URL di .env berhasil diarahkan ke PostgreSQL." -ForegroundColor Green

Write-Host "[3/4] Menjalankan migrasi skema & seeder (python -m app.db_setup)..." -ForegroundColor Cyan
$PythonExe = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}
& $PythonExe -m app.db_setup
if ($LASTEXITCODE -ne 0) {
    throw "Eksekusi app.db_setup gagal."
}

Write-Host "[4/4] Selesai! Jalankan API dengan: .\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000" -ForegroundColor Green
