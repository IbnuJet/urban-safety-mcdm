"""Unit and integration tests for AHP, TOPSIS, CSV validator, RBAC, and Worklist audit."""

from datetime import date, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.models import AlleySegment, CorridorEnum, DataSourceEnum, SegmentObservation
from app.seed import seed_database
from app.services.ahp_engine import calculate_ahp
from app.services.csv_validator import validate_csv_observations
from app.services.topsis_engine import (
    TOPSISInputItem,
    calculate_topsis,
    evaluate_segment_eligibility,
)


# ---------------------------------------------------------------------------
# Fixtures for isolated in-memory SQLite API tests
# ---------------------------------------------------------------------------


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as db:
        seed_database(db)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. AHP Engine Tests
# ---------------------------------------------------------------------------


def test_ahp_consistent_matrix_accuracy():
    # Perfectly consistent matrix: weights should be [2/7, 4/7, 1/7]
    matrix = [
        [1.0, 0.5, 2.0],
        [2.0, 1.0, 4.0],
        [0.5, 0.25, 1.0],
    ]
    res = calculate_ahp(matrix)

    assert pytest.approx(res.w_light_damage, rel=1e-6) == 2.0 / 7.0
    assert pytest.approx(res.w_dawn_crime, rel=1e-6) == 4.0 / 7.0
    assert pytest.approx(res.w_boarding_density, rel=1e-6) == 1.0 / 7.0
    assert pytest.approx(
        res.w_light_damage + res.w_dawn_crime + res.w_boarding_density, rel=1e-6
    ) == 1.0
    assert pytest.approx(res.lambda_max, abs=1e-6) == 3.0
    assert res.ci == 0.0
    assert res.cr == 0.0
    assert res.is_consistent is True


def test_ahp_inconsistent_matrix_flagged():
    # Strongly inconsistent matrix: C1 > C2 (9), C2 > C3 (9), C3 > C1 (9)
    matrix = [
        [1.0, 9.0, 1.0 / 9.0],
        [1.0 / 9.0, 1.0, 9.0],
        [9.0, 1.0 / 9.0, 1.0],
    ]
    res = calculate_ahp(matrix)

    assert res.cr > 0.10
    assert res.is_consistent is False


def test_ahp_reject_activation_when_cr_above_threshold(client: TestClient):
    headers = _login(client, "penilai", "penilai123")
    inconsistent_matrix = [
        [1.0, 9.0, 1.0 / 9.0],
        [1.0 / 9.0, 1.0, 9.0],
        [9.0, 1.0 / 9.0, 1.0],
    ]

    create_resp = client.post(
        "/api/v1/ahp/versions",
        headers=headers,
        json={
            "version_name": "Matriks Tidak Konsisten",
            "pairwise_matrix": inconsistent_matrix,
            "activate_immediately": True,
        },
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["is_consistent"] is False
    assert created["is_active"] is False
    assert created["cr"] > 0.10

    activate_resp = client.patch(
        f"/api/v1/ahp/versions/{created['id']}/activate",
        headers=headers,
    )
    assert activate_resp.status_code == 400


# ---------------------------------------------------------------------------
# 2. TOPSIS Engine & Tie-Breaker Tests
# ---------------------------------------------------------------------------


def test_topsis_ranking_accuracy_and_edge_cases():
    items = [
        TOPSISInputItem(1, "GG-A", broken_lights=8, dawn_crime_count=6, boarding_house_count=20),
        TOPSISInputItem(2, "GG-B", broken_lights=2, dawn_crime_count=1, boarding_house_count=5),
        TOPSISInputItem(3, "GG-C", broken_lights=5, dawn_crime_count=3, boarding_house_count=12),
    ]
    weights = (0.30, 0.50, 0.20)
    ranked = calculate_topsis(items, weights)

    assert [r.segment_code for r in ranked] == ["GG-A", "GG-C", "GG-B"]
    assert [r.rank for r in ranked] == [1, 2, 3]
    assert pytest.approx(ranked[0].preference_score, abs=1e-6) == 1.0
    assert pytest.approx(ranked[-1].preference_score, abs=1e-6) == 0.0
    assert all(r.is_tie_broken is False for r in ranked)


def test_topsis_single_segment_and_zero_column():
    single = [
        TOPSISInputItem(10, "GG-SINGLE", broken_lights=4, dawn_crime_count=0, boarding_house_count=10)
    ]
    ranked_single = calculate_topsis(single, (0.4, 0.4, 0.2))
    assert len(ranked_single) == 1
    assert ranked_single[0].preference_score == 1.0
    assert ranked_single[0].rank == 1
    assert ranked_single[0].norm_c2 == 0.0

    # Multiple segments with zero column on C2 (dawn_crime_count == 0 for all)
    zero_c2 = [
        TOPSISInputItem(1, "GG-01", broken_lights=6, dawn_crime_count=0, boarding_house_count=10),
        TOPSISInputItem(2, "GG-02", broken_lights=3, dawn_crime_count=0, boarding_house_count=5),
    ]
    ranked_zero = calculate_topsis(zero_c2, (0.3, 0.5, 0.2))
    assert ranked_zero[0].segment_code == "GG-01"
    assert ranked_zero[0].norm_c2 == 0.0


def test_topsis_tie_breaker_deterministic_order():
    # Identical values -> identical preference score -> tie-broken flag & segment_code ASC
    identical = [
        TOPSISInputItem(2, "GG-Z", broken_lights=5, dawn_crime_count=3, boarding_house_count=10),
        TOPSISInputItem(1, "GG-A", broken_lights=5, dawn_crime_count=3, boarding_house_count=10),
        TOPSISInputItem(3, "GG-LOW", broken_lights=1, dawn_crime_count=1, boarding_house_count=2),
    ]
    ranked = calculate_topsis(identical, (0.3, 0.5, 0.2))

    assert ranked[0].segment_code == "GG-A"
    assert ranked[1].segment_code == "GG-Z"
    assert ranked[0].is_tie_broken is True
    assert ranked[1].is_tie_broken is True
    assert ranked[2].is_tie_broken is False

    # Same preference score via symmetric weights:
    # Weights equal (1/3, 1/3, 1/3):
    # Seg 1: (4, 6, 10) vs Seg 2: (6, 4, 10) -> same norm sums and distances -> same C_i!
    # Tie-breaker must prioritize higher dawn_crime_count (Seg 1: 6 > Seg 2: 4).
    symmetric = [
        TOPSISInputItem(1, "GG-CRIME-LOW", broken_lights=6, dawn_crime_count=4, boarding_house_count=10),
        TOPSISInputItem(2, "GG-CRIME-HIGH", broken_lights=4, dawn_crime_count=6, boarding_house_count=10),
        TOPSISInputItem(3, "GG-BASE", broken_lights=1, dawn_crime_count=1, boarding_house_count=1),
    ]
    ranked_sym = calculate_topsis(symmetric, (1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0))
    assert pytest.approx(ranked_sym[0].preference_score, abs=1e-6) == pytest.approx(
        ranked_sym[1].preference_score, abs=1e-6
    )
    assert ranked_sym[0].segment_code == "GG-CRIME-HIGH"
    assert ranked_sym[1].segment_code == "GG-CRIME-LOW"
    assert ranked_sym[0].is_tie_broken is True
    assert ranked_sym[1].is_tie_broken is True


def test_eligibility_rules():
    today = date(2026, 11, 13)
    seg = AlleySegment(
        id=1,
        segment_code="GG-TEST-01",
        name="Gang Test",
        corridor=CorridorEnum.CISEKE,
        geojson_geometry={"type": "LineString", "coordinates": [[107.77, -6.93], [107.78, -6.94]]},
        is_active=True,
    )
    obs_zero_broken = SegmentObservation(
        segment_id=1,
        total_lights=10,
        broken_lights=0,
        dawn_crime_count=3,
        boarding_house_count=10,
        inspection_date=today - timedelta(days=5),
        data_source=DataSourceEnum.MANUAL_FORM,
        updated_by=1,
    )
    eligible, reason = evaluate_segment_eligibility(seg, obs_zero_broken, today, 90)
    assert eligible is False
    assert "0 kerusakan" in (reason or "")

    obs_expired = SegmentObservation(
        segment_id=1,
        total_lights=10,
        broken_lights=4,
        dawn_crime_count=3,
        boarding_house_count=10,
        inspection_date=today - timedelta(days=91),
        data_source=DataSourceEnum.MANUAL_FORM,
        updated_by=1,
    )
    eligible_exp, _ = evaluate_segment_eligibility(seg, obs_expired, today, 90)
    assert eligible_exp is False


# ---------------------------------------------------------------------------
# 3. CSV Validator Tests
# ---------------------------------------------------------------------------


def test_csv_validator_sample_file():
    sample_path = Path(__file__).resolve().parents[1] / "sample_data" / "sample_jatinangor_import.csv"
    csv_bytes = sample_path.read_bytes()
    known_codes = {
        "GG-CSK-001",
        "GG-CRG-001",
        "GG-GHN-001",
        "GG-HGM-001",
        "GG-SKW-001",
        "GG-SKW-002",
    }
    summary = validate_csv_observations(
        csv_bytes=csv_bytes,
        known_segment_codes=known_codes,
        reference_date=date(2026, 11, 13),
        expiry_days=90,
    )

    assert summary.total_rows == 8
    assert summary.valid_rows == 2  # GG-CRG-001 and GG-GHN-001
    assert summary.warning_rows == 2  # expired date + incomplete crime
    assert summary.error_rows == 4  # 2 duplicate GG-CSK-001 + broken>total + unknown

    issue_codes = {
        issue["code"]
        for row in summary.rows
        for issue in row["issues"]
    }
    assert {
        "DUPLICATE_SEGMENT_IN_BATCH",
        "UNKNOWN_SEGMENT_CODE",
        "EXPIRED_INSPECTION_DATE",
        "INCOMPLETE_CRIME_DATA",
        "INVALID_LIGHT_LOGIC",
    }.issubset(issue_codes)


# ---------------------------------------------------------------------------
# 4. End-to-End API, RBAC, Map, Worklist Override & CSV Export Tests
# ---------------------------------------------------------------------------


def test_worklist_override_rejected_without_reason_and_accepted_with_reason(
    client: TestClient,
):
    pju_headers = _login(client, "pju_lead", "pju123")
    operator_headers = _login(client, "operator", "operator123")

    # RBAC check: OPERATOR cannot execute TOPSIS cycle
    forbidden_resp = client.post(
        "/api/v1/topsis/cycles",
        headers=operator_headers,
        json={"cycle_name": "Unauthorized Cycle"},
    )
    assert forbidden_resp.status_code == 403

    # Run TOPSIS cycle as PENANGGUNG_JAWAB_PJU
    cycle_resp = client.post(
        "/api/v1/topsis/cycles",
        headers=pju_headers,
        json={"cycle_name": "Siklus Evaluasi November 2026"},
    )
    assert cycle_resp.status_code == 201, cycle_resp.text
    cycle_data = cycle_resp.json()
    cycle_id = cycle_data["cycle_id"]
    assert cycle_data["eligible_count"] == 11
    assert cycle_data["ineligible_count"] == 1  # GG-HGM-002 has 0 broken lights

    # Propose Top-3 worklist
    propose_resp = client.post(
        f"/api/v1/worklists/cycles/{cycle_id}/propose",
        headers=pju_headers,
        json={"capacity_quota": 3},
    )
    assert propose_resp.status_code == 200
    propose_data = propose_resp.json()
    proposed_ids = [item["segment_id"] for item in propose_data["system_proposed"]]
    reserve_id = propose_data["reserve_candidates"][0]["segment_id"]
    override_ids = [proposed_ids[0], proposed_ids[1], reserve_id]

    # Attempt finalize with override but NO reason -> must be 422
    bad_finalize = client.post(
        f"/api/v1/worklists/cycles/{cycle_id}/finalize",
        headers=pju_headers,
        json={
            "capacity_quota": 3,
            "final_selected_segment_ids": override_ids,
            "override_reason": "",
        },
    )
    assert bad_finalize.status_code == 422
    assert "Alasan perubahan wajib diisi" in bad_finalize.json()["detail"]

    # Attempt finalize with short reason (< 10 chars) -> must be 422
    short_finalize = client.post(
        f"/api/v1/worklists/cycles/{cycle_id}/finalize",
        headers=pju_headers,
        json={
            "capacity_quota": 3,
            "final_selected_segment_ids": override_ids,
            "override_reason": "pendek",
        },
    )
    assert short_finalize.status_code == 422

    # Valid override reason -> succeeds (201)
    good_finalize = client.post(
        f"/api/v1/worklists/cycles/{cycle_id}/finalize",
        headers=pju_headers,
        json={
            "capacity_quota": 3,
            "final_selected_segment_ids": override_ids,
            "override_reason": "Segmen cadangan berada di jalur akses utama kos mahasiswa yang sedang rawan.",
        },
    )
    assert good_finalize.status_code == 201, good_finalize.text
    decision = good_finalize.json()
    assert decision["is_overridden"] is True

    # Map priority layer returns GeoJSON FeatureCollection
    map_resp = client.get(
        f"/api/v1/map/priority-layer?cycle_id={cycle_id}",
        headers=pju_headers,
    )
    assert map_resp.status_code == 200
    geojson = map_resp.json()
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == 12

    # Export CSV works and reflects USULAN_SISTEM & PILIHAN_OVERRIDE
    csv_resp = client.get(
        f"/api/v1/history/cycles/{cycle_id}/export-csv",
        headers=pju_headers,
    )
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    csv_text = csv_resp.text
    assert "No_Urut_Kerja,Peringkat_TOPSIS,Kode_Segmen" in csv_text
    assert "USULAN_SISTEM" in csv_text
    assert "PILIHAN_OVERRIDE" in csv_text

    # Map segment detail & history list
    detail_resp = client.get(
        f"/api/v1/map/segments/{proposed_ids[0]}/detail?cycle_id={cycle_id}",
        headers=pju_headers,
    )
    assert detail_resp.status_code == 200
    assert detail_resp.json()["rank"] == 1

    history_resp = client.get("/api/v1/history/cycles", headers=pju_headers)
    assert history_resp.status_code == 200
    assert history_resp.json()[0]["is_overridden"] is True


def test_csv_upload_confirm_and_admin_rbac(client: TestClient):
    admin_headers = _login(client, "admin", "admin123")
    operator_headers = _login(client, "operator", "operator123")

    # Non-admin cannot list users
    assert client.get("/api/v1/users", headers=operator_headers).status_code == 403
    users_resp = client.get("/api/v1/users", headers=admin_headers)
    assert users_resp.status_code == 200
    assert len(users_resp.json()) == 4

    # Upload sample CSV as operator
    sample_path = (
        Path(__file__).resolve().parents[1]
        / "sample_data"
        / "sample_jatinangor_import.csv"
    )
    with sample_path.open("rb") as f:
        upload_resp = client.post(
            "/api/v1/observations/upload-csv",
            headers=operator_headers,
            files={"file": ("sample_jatinangor_import.csv", f, "text/csv")},
        )
    assert upload_resp.status_code == 201, upload_resp.text
    preview = upload_resp.json()
    assert preview["total_rows"] == 8
    assert preview["valid_rows"] == 2
    assert preview["warning_rows"] == 2
    assert preview["error_rows"] == 4

    # Confirm valid & warning rows (skipping 4 error rows)
    confirm_resp = client.post(
        f"/api/v1/observations/batches/{preview['batch_id']}/confirm",
        headers=operator_headers,
        json={"include_warnings": True, "corrections": []},
    )
    assert confirm_resp.status_code == 200, confirm_resp.text
    confirmed = confirm_resp.json()
    assert confirmed["committed_count"] == 4
    assert confirmed["skipped_error_count"] == 4


def test_figma_aligned_endpoints_and_workflows(client: TestClient):
    # 1. Email login (Screen 00) & Password reset (Screen 08b)
    email_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@jatinangor-dss.id", "password": "admin123"},
    )
    assert email_login.status_code == 200, email_login.text
    admin_headers = {"Authorization": f"Bearer {email_login.json()['access_token']}"}

    users = client.get("/api/v1/users", headers=admin_headers).json()
    op_user = next(u for u in users if u["username"] == "operator")
    reset_resp = client.patch(
        f"/api/v1/users/{op_user['id']}",
        headers=admin_headers,
        json={"password": "operator_new123"},
    )
    assert reset_resp.status_code == 200, reset_resp.text
    op_headers = _login(client, "operator@jatinangor-dss.id", "operator_new123")

    # 2. Segments list includes has_geometry and last_inspection_date (Screen 02)
    seg_resp = client.get("/api/v1/segments", headers=op_headers)
    assert seg_resp.status_code == 200
    segments = seg_resp.json()
    assert len(segments) == 12
    assert all(s["has_geometry"] is True for s in segments)
    assert all(s["last_inspection_date"] is not None for s in segments)

    # 3. Observations validation-summary, csv-template, GET batch & DELETE batch (Screens 03/03b/03c)
    val_resp = client.get("/api/v1/observations/validation-summary", headers=op_headers)
    assert val_resp.status_code == 200
    val_data = val_resp.json()
    assert val_data["total_segments"] == 12
    assert val_data["complete_and_fresh_count"] >= 10

    tpl_resp = client.get("/api/v1/observations/csv-template", headers=op_headers)
    assert tpl_resp.status_code == 200
    assert "segment_code,total_lights,broken_lights" in tpl_resp.text

    sample_path = (
        Path(__file__).resolve().parents[1]
        / "sample_data"
        / "sample_jatinangor_import.csv"
    )
    with sample_path.open("rb") as f:
        up_resp = client.post(
            "/api/v1/observations/upload-csv",
            headers=op_headers,
            files={"file": ("sample_jatinangor_import.csv", f, "text/csv")},
        )
    assert up_resp.status_code == 201
    batch_id = up_resp.json()["batch_id"]

    get_batch = client.get(f"/api/v1/observations/batches/{batch_id}", headers=op_headers)
    assert get_batch.status_code == 200
    assert get_batch.json()["batch_id"] == batch_id

    del_batch = client.delete(
        f"/api/v1/observations/batches/{batch_id}", headers=op_headers
    )
    assert del_batch.status_code == 204
    cancelled_batch = client.get(
        f"/api/v1/observations/batches/{batch_id}", headers=op_headers
    )
    assert cancelled_batch.status_code == 200
    assert cancelled_batch.json()["status"] == "CANCELLED"
    assert (
        client.post(
            f"/api/v1/observations/batches/{batch_id}/confirm",
            headers=op_headers,
            json={"include_warnings": True, "corrections": []},
        ).status_code
        == 400
    )

    # 4. AHP calculate-preview via saaty_comparisons (Screen 04)
    penilai_headers = _login(client, "penilai", "penilai123")
    ahp_preview = client.post(
        "/api/v1/ahp/calculate-preview",
        headers=penilai_headers,
        json={"saaty_comparisons": {"c1_vs_c2": 3, "c1_vs_c3": 5, "c2_vs_c3": 2}},
    )
    assert ahp_preview.status_code == 200, ahp_preview.text
    assert ahp_preview.json()["is_consistent"] is True

    # 5. TOPSIS latest, Map summary, Worklist detail, and History detail (Screens 01, 05, 07b, 07c)
    pju_headers = _login(client, "pju_lead", "pju123")
    c_resp = client.post(
        "/api/v1/topsis/cycles",
        headers=pju_headers,
        json={"cycle_name": "Siklus Uji Figma Alignment"},
    )
    assert c_resp.status_code == 201
    cycle_id = c_resp.json()["cycle_id"]

    latest_resp = client.get("/api/v1/topsis/cycles/latest", headers=pju_headers)
    assert latest_resp.status_code == 200
    assert latest_resp.json()["cycle_id"] == cycle_id

    propose_data = client.post(
        f"/api/v1/worklists/cycles/{cycle_id}/propose",
        headers=pju_headers,
        json={"capacity_quota": 2},
    ).json()
    proposed_ids = [x["segment_id"] for x in propose_data["system_proposed"]]
    reserve_id = propose_data["reserve_candidates"][0]["segment_id"]

    fin_resp = client.post(
        f"/api/v1/worklists/cycles/{cycle_id}/finalize",
        headers=pju_headers,
        json={
            "capacity_quota": 2,
            "final_selected_segment_ids": [proposed_ids[0], reserve_id],
            "override_reason": "Prioritas akses kos mahasiswa yang sedang padam total.",
        },
    )
    assert fin_resp.status_code == 201

    map_resp = client.get(
        f"/api/v1/map/priority-layer?cycle_id={cycle_id}", headers=pju_headers
    )
    assert map_resp.status_code == 200
    summary = map_resp.json()["summary"]
    assert summary["total_segments"] == 12
    assert summary["capacity_quota"] == 2
    assert summary["eligible_count"] == 11
    assert summary["ineligible_count"] == 1

    wl_detail = client.get(f"/api/v1/worklists/cycles/{cycle_id}", headers=pju_headers)
    assert wl_detail.status_code == 200
    wl_json = wl_detail.json()
    assert wl_json["decision"]["is_overridden"] is True
    assert len(wl_json["selected_segments"]) == 2
    assert len(wl_json["replaced_proposed_segments"]) == 1

    hist_detail = client.get(f"/api/v1/history/cycles/{cycle_id}", headers=pju_headers)
    assert hist_detail.status_code == 200
    hist_json = hist_detail.json()
    assert hist_json["summary"]["cycle_id"] == cycle_id
    assert hist_json["worklist"] is not None
    assert len(hist_json["eligible_results"]) == 11


