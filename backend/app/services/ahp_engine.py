"""AHP (Analytic Hierarchy Process) weighting and consistency engine using NumPy."""

from dataclasses import dataclass

import numpy as np

RANDOM_INDEX: dict[int, float] = {
    1: 0.00,
    2: 0.00,
    3: 0.58,
    4: 0.90,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49,
    11: 1.51,
    12: 1.48,
    13: 1.56,
    14: 1.57,
    15: 1.59,
}
CR_THRESHOLD: float = 0.10


@dataclass(frozen=True)
class AHPResult:
    """AHP priority weights and consistency metrics for any supported matrix size."""

    pairwise_matrix: list[list[float]]
    weights: list[float]
    lambda_max: float
    ci: float
    ri: float
    cr: float
    is_consistent: bool


def calculate_ahp(pairwise_matrix: list[list[float]]) -> AHPResult:
    """Compute AHP weights and consistency metrics for an N×N pairwise matrix."""
    try:
        matrix = np.asarray(pairwise_matrix, dtype=np.float64)
    except (TypeError, ValueError) as exc:
        raise ValueError("Matriks perbandingan berpasangan AHP harus berisi angka.") from exc

    if matrix.ndim != 2 or matrix.shape[0] != matrix.shape[1] or matrix.shape[0] < 1:
        raise ValueError("Matriks perbandingan berpasangan AHP harus berbentuk persegi N×N.")
    n = matrix.shape[0]
    if n not in RANDOM_INDEX:
        raise ValueError(
            f"Jumlah kriteria AHP harus antara 1 dan {max(RANDOM_INDEX)}."
        )
    if not np.all(np.isfinite(matrix)) or np.any(matrix <= 0.0):
        raise ValueError("Seluruh elemen matriks AHP harus bernilai numerik positif (> 0).")

    for i in range(n):
        if abs(matrix[i, i] - 1.0) > 1e-6:
            raise ValueError(
                f"Elemen diagonal matriks AHP pada posisi ({i + 1}, {i + 1}) harus bernilai 1."
            )
        for j in range(i + 1, n):
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
    ci = 0.0 if n <= 2 else float((lambda_max - n) / (n - 1))
    if -1e-12 <= ci < 0.0:
        ci = 0.0
    ri = RANDOM_INDEX[n]
    cr = 0.0 if ri == 0.0 else float(ci / ri)
    is_consistent = bool(cr <= CR_THRESHOLD)

    return AHPResult(
        pairwise_matrix=[[float(val) for val in row] for row in matrix.tolist()],
        weights=[float(weight) for weight in weights],
        lambda_max=lambda_max,
        ci=ci,
        ri=ri,
        cr=cr,
        is_consistent=is_consistent,
    )
