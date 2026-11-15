"""TOPSIS ranking engine and segment eligibility rules using NumPy."""

from collections import Counter
from dataclasses import dataclass
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


@dataclass(frozen=True)
class TOPSISRankedItem:
    """Computed TOPSIS metrics and final deterministic rank for one eligible segment."""

    segment_id: int
    segment_code: str
    broken_lights: int
    dawn_crime_count: int
    boarding_house_count: int
    norm_c1: float
    norm_c2: float
    norm_c3: float
    weighted_c1: float
    weighted_c2: float
    weighted_c3: float
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
    if observation.dawn_crime_count is None:
        return False, "Data rekap curanmor dini hari belum lengkap (null)."
    if observation.broken_lights <= 0:
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
    weights: tuple[float, float, float],
    criteria_directions: tuple[
        Literal["max", "min"], Literal["max", "min"], Literal["max", "min"]
    ] = ("max", "max", "max"),
) -> list[TOPSISRankedItem]:
    """Run explicit NumPy TOPSIS ranking with edge-case handling and deterministic tie-breaking.

    Criteria columns:
    - C1: broken_lights
    - C2: dawn_crime_count
    - C3: boarding_house_count
    """
    m = len(items)
    if m == 0:
        return []

    w = np.asarray(weights, dtype=np.float64)
    if w.shape != (3,) or np.any(w < 0.0) or float(np.sum(w)) <= 0.0:
        raise ValueError("Vektor bobot TOPSIS harus terdiri dari 3 nilai non-negatif dengan jumlah > 0.")

    X = np.array(
        [
            [
                float(item.broken_lights),
                float(item.dawn_crime_count),
                float(item.boarding_house_count),
            ]
            for item in items
        ],
        dtype=np.float64,
    )

    # 1. Euclidean vector normalization (safe against zero-norm columns)
    col_norms = np.sqrt(np.sum(X**2, axis=0))
    R = np.zeros_like(X, dtype=np.float64)
    for j in range(3):
        if col_norms[j] > 0.0:
            R[:, j] = X[:, j] / col_norms[j]
        else:
            R[:, j] = 0.0

    # 2. Weighted normalized matrix
    V = R * w

    # Edge case: single eligible segment
    if m == 1:
        item = items[0]
        return [
            TOPSISRankedItem(
                segment_id=item.segment_id,
                segment_code=item.segment_code,
                broken_lights=item.broken_lights,
                dawn_crime_count=item.dawn_crime_count,
                boarding_house_count=item.boarding_house_count,
                norm_c1=float(R[0, 0]),
                norm_c2=float(R[0, 1]),
                norm_c3=float(R[0, 2]),
                weighted_c1=float(V[0, 0]),
                weighted_c2=float(V[0, 1]),
                weighted_c3=float(V[0, 2]),
                d_plus=0.0,
                d_minus=0.0,
                preference_score=1.0,
                rank=1,
                is_tie_broken=False,
            )
        ]

    # 3. Ideal positive (A+) and negative (A-) solutions
    a_plus = np.zeros(3, dtype=np.float64)
    a_minus = np.zeros(3, dtype=np.float64)
    for j in range(3):
        if criteria_directions[j] == "max":
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
                "d_plus": float(d_plus[idx]),
                "d_minus": float(d_minus[idx]),
                "score": score_val,
                "is_tie_broken": is_tie,
            }
        )

    # 6. Deterministic tie-breaker sorting
    preliminary.sort(
        key=lambda row: (
            -round(row["score"], 6),
            -row["item"].dawn_crime_count,
            -row["item"].broken_lights,
            -row["item"].boarding_house_count,
            row["item"].segment_code,
        )
    )

    ranked_results: list[TOPSISRankedItem] = []
    for rank_idx, row in enumerate(preliminary, start=1):
        item = row["item"]
        ranked_results.append(
            TOPSISRankedItem(
                segment_id=item.segment_id,
                segment_code=item.segment_code,
                broken_lights=item.broken_lights,
                dawn_crime_count=item.dawn_crime_count,
                boarding_house_count=item.boarding_house_count,
                norm_c1=float(row["norm"][0]),
                norm_c2=float(row["norm"][1]),
                norm_c3=float(row["norm"][2]),
                weighted_c1=float(row["weighted"][0]),
                weighted_c2=float(row["weighted"][1]),
                weighted_c3=float(row["weighted"][2]),
                d_plus=row["d_plus"],
                d_minus=row["d_minus"],
                preference_score=row["score"],
                rank=rank_idx,
                is_tie_broken=row["is_tie_broken"],
            )
        )

    return ranked_results
