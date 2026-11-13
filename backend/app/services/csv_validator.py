"""CSV parsing and pre-commit validation service for field observation imports."""

from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
import io
from typing import Any

import pandas as pd

REQUIRED_CSV_COLUMNS = {
    "segment_code",
    "total_lights",
    "broken_lights",
    "dawn_crime_count",
    "boarding_house_count",
    "inspection_date",
}


@dataclass(frozen=True)
class CSVValidationSummary:
    """Aggregated validation results for an uploaded CSV batch."""

    total_rows: int
    valid_rows: int
    warning_rows: int
    error_rows: int
    rows: list[dict[str, Any]]


def _parse_int(raw: str) -> tuple[int | None, bool]:
    """Parse integer from string; returns (value, is_missing)."""
    cleaned = raw.strip()
    if cleaned == "" or cleaned.lower() in {"nan", "null", "none", "na"}:
        return None, True
    # Accept integer strings or clean float strings like "4.0"
    try:
        if "." in cleaned:
            as_float = float(cleaned)
            if not as_float.is_integer():
                raise ValueError("Bukan bilangan bulat.")
            return int(as_float), False
        return int(cleaned), False
    except ValueError as exc:
        raise ValueError(f"Nilai '{cleaned}' bukan bilangan bulat valid.") from exc


def _parse_date(raw: str) -> date:
    """Parse YYYY-MM-DD (or common ISO/slash formats) into a date object."""
    cleaned = raw.strip()
    if not cleaned:
        raise ValueError("Tanggal inspeksi kosong.")
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Format tanggal '{cleaned}' tidak valid (gunakan YYYY-MM-DD).")


def validate_csv_observations(
    csv_bytes: bytes,
    known_segment_codes: set[str],
    reference_date: date,
    expiry_days: int,
) -> CSVValidationSummary:
    """Parse and validate CSV observation rows before staging into csv_import_batches."""
    try:
        text = csv_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("File CSV harus menggunakan encoding UTF-8.") from exc

    if not text.strip():
        raise ValueError("File CSV kosong.")

    try:
        df = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False)
    except Exception as exc:
        raise ValueError(f"Gagal mem-parsing file CSV: {exc}") from exc

    df.columns = [str(col).strip() for col in df.columns]
    missing_cols = REQUIRED_CSV_COLUMNS - set(df.columns)
    if missing_cols:
        missing_list = ", ".join(sorted(missing_cols))
        raise ValueError(f"Kolom wajib CSV tidak ditemukan: {missing_list}.")

    if len(df) == 0:
        raise ValueError("File CSV tidak memiliki baris data.")

    normalized_codes = [str(val).strip().upper() for val in df["segment_code"].tolist()]
    code_counts = Counter(code for code in normalized_codes if code)

    validated_rows: list[dict[str, Any]] = []
    valid_count = 0
    warning_count = 0
    error_count = 0

    for idx, row in df.iterrows():
        row_number = int(idx) + 2  # 1-based line number accounting for CSV header
        raw_code = str(row["segment_code"]).strip().upper()
        issues: list[dict[str, str]] = []

        # 1. Segment code checks
        if not raw_code:
            issues.append(
                {
                    "code": "MISSING_SEGMENT_CODE",
                    "severity": "ERROR",
                    "message": "Kode segmen (segment_code) wajib diisi.",
                }
            )
        else:
            if code_counts[raw_code] > 1:
                issues.append(
                    {
                        "code": "DUPLICATE_SEGMENT_IN_BATCH",
                        "severity": "ERROR",
                        "message": f"Duplikat segment_code '{raw_code}' ditemukan dalam batch CSV.",
                    }
                )
            if raw_code not in known_segment_codes:
                issues.append(
                    {
                        "code": "UNKNOWN_SEGMENT_CODE",
                        "severity": "ERROR",
                        "message": f"Kode segmen '{raw_code}' belum terdaftar pada master segmen gang.",
                    }
                )

        # 2. Numeric indicators parsing
        total_lights: int | None = None
        broken_lights: int | None = None
        dawn_crime_count: int | None = None
        boarding_house_count: int | None = None

        try:
            total_lights, missing_total = _parse_int(str(row["total_lights"]))
            if missing_total:
                issues.append(
                    {
                        "code": "INVALID_LIGHT_LOGIC",
                        "severity": "ERROR",
                        "message": "Nilai total_lights wajib diisi.",
                    }
                )
        except ValueError as exc:
            issues.append(
                {
                    "code": "INVALID_LIGHT_LOGIC",
                    "severity": "ERROR",
                    "message": f"total_lights tidak valid: {exc}",
                }
            )

        try:
            broken_lights, missing_broken = _parse_int(str(row["broken_lights"]))
            if missing_broken:
                issues.append(
                    {
                        "code": "INVALID_LIGHT_LOGIC",
                        "severity": "ERROR",
                        "message": "Nilai broken_lights wajib diisi.",
                    }
                )
        except ValueError as exc:
            issues.append(
                {
                    "code": "INVALID_LIGHT_LOGIC",
                    "severity": "ERROR",
                    "message": f"broken_lights tidak valid: {exc}",
                }
            )

        if total_lights is not None and total_lights < 0:
            issues.append(
                {
                    "code": "INVALID_LIGHT_LOGIC",
                    "severity": "ERROR",
                    "message": "Nilai total_lights tidak boleh negatif.",
                }
            )
        if broken_lights is not None and broken_lights < 0:
            issues.append(
                {
                    "code": "INVALID_LIGHT_LOGIC",
                    "severity": "ERROR",
                    "message": "Nilai broken_lights tidak boleh negatif.",
                }
            )
        if (
            total_lights is not None
            and broken_lights is not None
            and broken_lights > total_lights
        ):
            issues.append(
                {
                    "code": "INVALID_LIGHT_LOGIC",
                    "severity": "ERROR",
                    "message": f"Jumlah lampu mati ({broken_lights}) melebihi total lampu terpasang ({total_lights}).",
                }
            )

        # 3. Dawn crime count (nullable during staging -> WARNING if missing, ERROR if negative/invalid)
        try:
            dawn_crime_count, missing_crime = _parse_int(str(row["dawn_crime_count"]))
            if missing_crime:
                issues.append(
                    {
                        "code": "INCOMPLETE_CRIME_DATA",
                        "severity": "WARNING",
                        "message": "Data rekap curanmor dini hari (dawn_crime_count) kosong; segmen akan dianggap tidak layak evaluasi TOPSIS hingga dilengkapi.",
                    }
                )
            elif dawn_crime_count is not None and dawn_crime_count < 0:
                issues.append(
                    {
                        "code": "INCOMPLETE_CRIME_DATA",
                        "severity": "ERROR",
                        "message": "Nilai dawn_crime_count tidak boleh negatif.",
                    }
                )
        except ValueError as exc:
            issues.append(
                {
                    "code": "INCOMPLETE_CRIME_DATA",
                    "severity": "ERROR",
                    "message": f"dawn_crime_count tidak valid: {exc}",
                }
            )

        # 4. Boarding house count
        try:
            boarding_house_count, missing_boarding = _parse_int(
                str(row["boarding_house_count"])
            )
            if missing_boarding:
                issues.append(
                    {
                        "code": "INVALID_BOARDING_COUNT",
                        "severity": "ERROR",
                        "message": "Nilai boarding_house_count wajib diisi.",
                    }
                )
            elif boarding_house_count is not None and boarding_house_count < 0:
                issues.append(
                    {
                        "code": "INVALID_BOARDING_COUNT",
                        "severity": "ERROR",
                        "message": "Nilai boarding_house_count tidak boleh negatif.",
                    }
                )
        except ValueError as exc:
            issues.append(
                {
                    "code": "INVALID_BOARDING_COUNT",
                    "severity": "ERROR",
                    "message": f"boarding_house_count tidak valid: {exc}",
                }
            )

        # 5. Inspection date & expiry check
        parsed_date_str: str | None = None
        try:
            parsed_date = _parse_date(str(row["inspection_date"]))
            parsed_date_str = parsed_date.isoformat()
            age_days = (reference_date - parsed_date).days
            if age_days > expiry_days:
                issues.append(
                    {
                        "code": "EXPIRED_INSPECTION_DATE",
                        "severity": "WARNING",
                        "message": f"Tanggal inspeksi kedaluwarsa ({age_days} hari yang lalu, batas maksimal {expiry_days} hari).",
                    }
                )
        except ValueError as exc:
            issues.append(
                {
                    "code": "INVALID_INSPECTION_DATE",
                    "severity": "ERROR",
                    "message": str(exc),
                }
            )

        has_error = any(issue["severity"] == "ERROR" for issue in issues)
        has_warning = any(issue["severity"] == "WARNING" for issue in issues)
        if has_error:
            row_status = "ERROR"
            error_count += 1
        elif has_warning:
            row_status = "WARNING"
            warning_count += 1
        else:
            row_status = "VALID"
            valid_count += 1

        validated_rows.append(
            {
                "row_number": row_number,
                "segment_code": raw_code,
                "total_lights": total_lights,
                "broken_lights": broken_lights,
                "dawn_crime_count": dawn_crime_count,
                "boarding_house_count": boarding_house_count,
                "inspection_date": parsed_date_str,
                "status": row_status,
                "issues": issues,
                "messages": [f"[{issue['code']}] {issue['message']}" for issue in issues],
            }
        )

    return CSVValidationSummary(
        total_rows=len(validated_rows),
        valid_rows=valid_count,
        warning_rows=warning_count,
        error_rows=error_count,
        rows=validated_rows,
    )
