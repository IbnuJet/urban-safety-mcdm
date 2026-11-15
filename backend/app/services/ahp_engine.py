"""AHP (Analytic Hierarchy Process) weighting and consistency engine using NumPy."""

from dataclasses import dataclass

import numpy as np

RI_3: float = 0.58
CR_THRESHOLD: float = 0.10


@dataclass(frozen=True)
class AHPResult:
    """Result of 3x3 AHP priority weight calculation and consistency check."""

    pairwise_matrix: list[list[float]]
    w_light_damage: float
    w_dawn_crime: float
    w_boarding_density: float
    lambda_max: float
    ci: float
    ri: float
    cr: float
    is_consistent: bool


def calculate_ahp(pairwise_matrix: list[list[float]]) -> AHPResult:
    """Compute AHP criterion weights and Consistency Ratio (CR) for a 3x3 matrix.

    Criteria order:
    - Index 0 (C1): Kerusakan Lampu PJU (broken_lights)
    - Index 1 (C2): Rekap Curanmor Dini Hari (dawn_crime_count)
    - Index 2 (C3): Kepadatan Indekos (boarding_house_count)
    """
    matrix = np.asarray(pairwise_matrix, dtype=np.float64)

    if matrix.shape != (3, 3):
        raise ValueError("Matriks perbandingan berpasangan AHP harus berukuran 3x3.")
    if not np.all(np.isfinite(matrix)) or np.any(matrix <= 0.0):
        raise ValueError("Seluruh elemen matriks AHP harus bernilai numerik positif (> 0).")

    for i in range(3):
        if abs(matrix[i, i] - 1.0) > 1e-6:
            raise ValueError(
                f"Elemen diagonal matriks AHP pada posisi ({i + 1}, {i + 1}) harus bernilai 1."
            )
        for j in range(i + 1, 3):
            product = matrix[i, j] * matrix[j, i]
            if abs(product - 1.0) > 0.02:
                raise ValueError(
                    f"Elemen matriks pada ({i + 1}, {j + 1}) dan ({j + 1}, {i + 1}) "
                    "harus saling berkebalikan (a_ji = 1 / a_ij)."
                )

    # 1. Column sums & normalization
    col_sums = np.sum(matrix, axis=0)
    normalized_matrix = matrix / col_sums

    # 2. Priority weights (row mean of normalized matrix)
    weights = np.mean(normalized_matrix, axis=1)

    # 3. Consistency check
    weighted_sum = matrix @ weights
    lambda_max = float(np.mean(weighted_sum / weights))
    ci = float((lambda_max - 3.0) / (3.0 - 1.0))
    if -1e-12 <= ci < 0.0:
        ci = 0.0
    cr = float(ci / RI_3)
    is_consistent = bool(cr <= CR_THRESHOLD)

    return AHPResult(
        pairwise_matrix=[[float(val) for val in row] for row in matrix.tolist()],
        w_light_damage=float(weights[0]),
        w_dawn_crime=float(weights[1]),
        w_boarding_density=float(weights[2]),
        lambda_max=lambda_max,
        ci=ci,
        ri=RI_3,
        cr=cr,
        is_consistent=is_consistent,
    )
