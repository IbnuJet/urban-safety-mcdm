"""TOPSIS ranking engine and segment eligibility rules using NumPy."""

from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from typing import Literal, Sequence

import numpy as np

from app.models.models import AlleySegment, SegmentObservation


@dataclass(frozen=True)
class TOPSISInputItem:
    """Input row for an eligible alley segment."""

    segment_id: int
    segment_code: str
    broken_lights: int
    dawn_crime_count: int
    boarding_house_count: int
    criteria_values: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class TOPSISRankedItem:
    """Computed TOPSIS metrics and final deterministic rank for one eligible segment."""

    segment_id: int
    segment_code: str
    broken_lights: int
    dawn_crime_count: int
    boarding_house_count: int
    norm_c1: float | None
    norm_c2: float | None
    norm_c3: float | None
    weighted_c1: float | None
    weighted_c2: float | None
    weighted_c3: float | None
    normalized_values: dict[str, float]
    weighted_values: dict[str, float]
    d_plus: float
    d_minus: float
    preference_score: float
    rank: int
    is_tie_broken: bool


def evaluate_segment_eligibility(
    segment: AlleySegment,
    observation: SegmentObservation | None,
    reference_date: date,
    expiry_days: int,
    criteria_keys: Sequence[str] | None = None,
    criteria_values: dict[str, float] | None = None,
) -> tuple[bool, str | None]:
    """Evaluate whether a segment is eligible to enter the TOPSIS decision matrix."""
    if not segment.is_active:
        return False, "Segmen gang berstatus tidak aktif."
    if observation is None:
        return False, "Segmen belum memiliki data observasi lapangan."
    age_days = (reference_date - observation.inspection_date).days
    if age_days > expiry_days:
        return (
            False,
            f"Data observasi kedaluwarsa ({age_days} hari > batas {expiry_days} hari).",
        )
    if criteria_keys is None:
        if observation.dawn_crime_count is None:
            return False, "Data rekap curanmor dini hari belum lengkap (null)."
        if observation.broken_lights <= 0:
            return False, "Tidak ada lampu PJU mati (0 kerusakan)"
    else:
        legacy_values = {
            "broken_lights": observation.broken_lights,
            "dawn_crime_count": observation.dawn_crime_count,
            "boarding_house_count": observation.boarding_house_count,
        }
        values = criteria_values or {}
        for key in criteria_keys:
            value = legacy_values.get(key, values.get(key))
            if value is None:
                return False, f"Nilai kriteria '{key}' belum tersedia."
            if key == "broken_lights" and value <= 0:
                return False, "Tidak ada lampu PJU mati (0 kerusakan)"
    return True, None


def get_priority_category(
    is_eligible: bool, preference_score: float | None
) -> str:
    """Map TOPSIS preference score to priority category label."""
    if not is_eligible or preference_score is None:
        return "Tidak Layak"
    if preference_score >= 0.66:
        return "Tinggi"
    if preference_score >= 0.33:
        return "Sedang"
    return "Rendah"


def calculate_topsis(
    items: Sequence[TOPSISInputItem],
    weights: Sequence[float],
    criteria_directions: Sequence[Literal["max", "min"]] | None = None,
    criterion_keys: Sequence[str] | None = None,
) -> list[TOPSISRankedItem]:
    """Run NumPy TOPSIS over a dynamic number of criteria."""
    m = len(items)
    if m == 0:
        return []

    w = np.asarray(weights, dtype=np.float64)
    n = len(w)
    if n < 1 or not np.all(np.isfinite(w)) or np.any(w < 0.0) or float(np.sum(w)) <= 0.0:
        raise ValueError("Vektor bobot TOPSIS harus berisi nilai finite non-negatif dengan jumlah > 0.")

    default_values = {
        "broken_lights": lambda item: item.broken_lights,
        "dawn_crime_count": lambda item: item.dawn_crime_count,
        "boarding_house_count": lambda item: item.boarding_house_count,
    }
    keys = list(criterion_keys) if criterion_keys is not None else (
        ["broken_lights", "dawn_crime_count", "boarding_house_count"]
        if n == 3
        else [f"criterion_{index + 1}" for index in range(n)]
    )
    directions = list(criteria_directions) if criteria_directions is not None else ["max"] * n
    if len(keys) != n or len(set(keys)) != n:
        raise ValueError("Jumlah key kriteria harus sama dengan jumlah bobot dan tidak boleh duplikat.")
    if len(directions) != n or any(direction not in {"max", "min"} for direction in directions):
        raise ValueError("Arah setiap kriteria TOPSIS harus berupa 'max' atau 'min'.")

    values_by_item: list[list[float]] = []
    for item in items:
        values: list[float] = []
        for key in keys:
            if key in item.criteria_values:
                value = item.criteria_values[key]
            elif key in default_values:
                value = default_values[key](item)
            else:
                raise ValueError(f"Nilai untuk kriteria '{key}' tidak tersedia.")
            if not np.isfinite(value):
                raise ValueError(f"Nilai untuk kriteria '{key}' harus finite.")
            values.append(float(value))
        values_by_item.append(values)
    X = np.asarray(values_by_item, dtype=np.float64)

    # 1. Euclidean vector normalization (safe against zero-norm columns)
    col_norms = np.sqrt(np.sum(X**2, axis=0))
    R = np.zeros_like(X, dtype=np.float64)
    for j in range(n):
        if col_norms[j] > 0.0:
            R[:, j] = X[:, j] / col_norms[j]
        else:
            R[:, j] = 0.0

    # 2. Weighted normalized matrix
    V = R * w

    # Edge case: single eligible segment
    if m == 1:
        item = items[0]
        normalized_values = {
            key: float(R[0, index]) for index, key in enumerate(keys)
        }
        weighted_values = {
            key: float(V[0, index]) for index, key in enumerate(keys)
        }
        return [
            TOPSISRankedItem(
                segment_id=item.segment_id,
                segment_code=item.segment_code,
                broken_lights=item.broken_lights,
                dawn_crime_count=item.dawn_crime_count,
                boarding_house_count=item.boarding_house_count,
                norm_c1=normalized_values.get("broken_lights"),
                norm_c2=normalized_values.get("dawn_crime_count"),
                norm_c3=normalized_values.get("boarding_house_count"),
                weighted_c1=weighted_values.get("broken_lights"),
                weighted_c2=weighted_values.get("dawn_crime_count"),
                weighted_c3=weighted_values.get("boarding_house_count"),
                normalized_values=normalized_values,
                weighted_values=weighted_values,
                d_plus=0.0,
                d_minus=0.0,
                preference_score=1.0,
                rank=1,
                is_tie_broken=False,
            )
        ]

    # 3. Ideal positive (A+) and negative (A-) solutions
    a_plus = np.zeros(n, dtype=np.float64)
    a_minus = np.zeros(n, dtype=np.float64)
    for j in range(n):
        if directions[j] == "max":
            a_plus[j] = float(np.max(V[:, j]))
            a_minus[j] = float(np.min(V[:, j]))
        else:
            a_plus[j] = float(np.min(V[:, j]))
            a_minus[j] = float(np.max(V[:, j]))

    # 4. Euclidean distances D+ and D-
    d_plus = np.sqrt(np.sum((V - a_plus) ** 2, axis=1))
    d_minus = np.sqrt(np.sum((V - a_minus) ** 2, axis=1))

    # 5. Preference score C_i = D- / (D+ + D-), 0.0 when denominator is 0
    denom = d_plus + d_minus
    scores = np.where(denom > 0.0, d_minus / denom, 0.0)

    rounded_counts = Counter(round(float(score), 6) for score in scores)

    preliminary = []
    for idx, item in enumerate(items):
        score_val = float(scores[idx])
        is_tie = rounded_counts[round(score_val, 6)] > 1
        preliminary.append(
            {
                "item": item,
                "norm": R[idx],
                "weighted": V[idx],
                "values": X[idx],
                "d_plus": float(d_plus[idx]),
                "d_minus": float(d_minus[idx]),
                "score": score_val,
                "is_tie_broken": is_tie,
            }
        )

    # 6. Deterministic tie-breaker sorting
    tie_break_keys = (
        ["dawn_crime_count", "broken_lights", "boarding_house_count"]
        if criterion_keys is None and n == 3
        else keys
    )
    key_indexes = {key: index for index, key in enumerate(keys)}
    preliminary.sort(
        key=lambda row: (
            -round(row["score"], 6),
            *(
                -float(row["values"][key_indexes[key]])
                for key in tie_break_keys
                if key in key_indexes
            ),
            row["item"].segment_code,
        )
    )

    ranked_results: list[TOPSISRankedItem] = []
    for rank_idx, row in enumerate(preliminary, start=1):
        item = row["item"]
        normalized_values = {
            key: float(row["norm"][index]) for index, key in enumerate(keys)
        }
        weighted_values = {
            key: float(row["weighted"][index]) for index, key in enumerate(keys)
        }
        ranked_results.append(
            TOPSISRankedItem(
                segment_id=item.segment_id,
                segment_code=item.segment_code,
                broken_lights=item.broken_lights,
                dawn_crime_count=item.dawn_crime_count,
                boarding_house_count=item.boarding_house_count,
                norm_c1=normalized_values.get("broken_lights"),
                norm_c2=normalized_values.get("dawn_crime_count"),
                norm_c3=normalized_values.get("boarding_house_count"),
                weighted_c1=weighted_values.get("broken_lights"),
                weighted_c2=weighted_values.get("dawn_crime_count"),
                weighted_c3=weighted_values.get("boarding_house_count"),
                normalized_values=normalized_values,
                weighted_values=weighted_values,
                d_plus=row["d_plus"],
                d_minus=row["d_minus"],
                preference_score=row["score"],
                rank=rank_idx,
                is_tie_broken=row["is_tie_broken"],
            )
        )

    return ranked_results
