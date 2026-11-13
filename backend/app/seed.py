"""Idempotent database seeder for Jatinangor PJU DSS."""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, init_db
from app.core.security import hash_password
from app.models.models import (
    AHPWeightVersion,
    AlleySegment,
    CorridorEnum,
    DataSourceEnum,
    SegmentObservation,
    User,
    UserRole,
)
from app.services.ahp_engine import calculate_ahp


def seed_database(db: Session | None = None) -> None:
    """Populate initial users, 12 Jatinangor alley segments, observations, and active AHP weights."""
    own_session = db is None
    if own_session:
        init_db()
        db = SessionLocal()

    assert db is not None
    try:
        # 1. Default 4 RBAC users
        default_users = [
            ("admin", "admin@jatinangor-dss.id", "Administrator Sistem", UserRole.ADMIN, "admin123"),
            ("operator", "operator@jatinangor-dss.id", "Operator Lapangan Jatinangor", UserRole.OPERATOR, "operator123"),
            ("penilai", "penilai@jatinangor-dss.id", "Pakar Penilai AHP", UserRole.PENILAI, "penilai123"),
            ("pju_lead", "pju.lead@jatinangor-dss.id", "Penanggung Jawab PJU", UserRole.PENANGGUNG_JAWAB_PJU, "pju123"),
        ]
        user_map: dict[str, User] = {}
        for username, email, full_name, role, raw_password in default_users:
            existing = db.scalar(select(User).where(User.username == username))
            if existing is None:
                user = User(
                    username=username,
                    email=email,
                    full_name=full_name,
                    hashed_password=hash_password(raw_password),
                    role=role,
                    is_active=True,
                )
                db.add(user)
                db.flush()
                user_map[username] = user
            else:
                user_map[username] = existing

        operator_user = user_map["operator"]
        penilai_user = user_map["penilai"]

        # 2. Sample 12 alley segments across 5 Jatinangor corridors
        # Coordinates centered around Jatinangor campus area ([107.768, -6.932] .. [107.778, -6.940])
        sample_segments = [
            {
                "segment_code": "GG-CSK-001",
                "name": "Gang Ciseke Lama Utara",
                "corridor": CorridorEnum.CISEKE,
                "coords": [[107.7691, -6.9324], [107.7702, -6.9331], [107.7710, -6.9336]],
                "obs": (12, 7, 5, 18, 4),
            },
            {
                "segment_code": "GG-CSK-002",
                "name": "Gang Ciseke Baru Selatan",
                "corridor": CorridorEnum.CISEKE,
                "coords": [[107.7698, -6.9340], [107.7709, -6.9348], [107.7718, -6.9352]],
                "obs": (10, 4, 3, 14, 6),
            },
            {
                "segment_code": "GG-CSK-003",
                "name": "Gang Pondokan Ciseke Tengah",
                "corridor": CorridorEnum.CISEKE,
                "coords": [[107.7705, -6.9330], [107.7715, -6.9338]],
                "obs": (8, 5, 4, 22, 8),
            },
            {
                "segment_code": "GG-CRG-001",
                "name": "Gang Caringin Masjid Al-Falah",
                "corridor": CorridorEnum.CARINGIN,
                "coords": [[107.7720, -6.9345], [107.7731, -6.9354], [107.7740, -6.9361]],
                "obs": (14, 8, 6, 16, 3),
            },
            {
                "segment_code": "GG-CRG-002",
                "name": "Gang Caringin Timur Dekat Kolam",
                "corridor": CorridorEnum.CARINGIN,
                "coords": [[107.7732, -6.9358], [107.7744, -6.9367]],
                "obs": (9, 2, 1, 9, 10),
            },
            {
                "segment_code": "GG-GHN-001",
                "name": "Gang H. Nena Utama",
                "corridor": CorridorEnum.GANG_H_NENA,
                "coords": [[107.7712, -6.9360], [107.7723, -6.9369], [107.7731, -6.9375]],
                "obs": (11, 6, 7, 25, 2),
            },
            {
                "segment_code": "GG-GHN-002",
                "name": "Gang H. Nena Cabang Barat",
                "corridor": CorridorEnum.GANG_H_NENA,
                "coords": [[107.7704, -6.9365], [107.7713, -6.9372]],
                "obs": (8, 3, 2, 15, 7),
            },
            {
                "segment_code": "GG-HGM-001",
                "name": "Gang Hegarmanah Jaya 1",
                "corridor": CorridorEnum.HEGARMANAH,
                "coords": [[107.7742, -6.9332], [107.7753, -6.9340], [107.7762, -6.9347]],
                "obs": (15, 6, 4, 19, 5),
            },
            {
                "segment_code": "GG-HGM-002",
                "name": "Gang Hegarmanah Asri 2",
                "corridor": CorridorEnum.HEGARMANAH,
                "coords": [[107.7750, -6.9350], [107.7764, -6.9359]],
                "obs": (10, 0, 1, 11, 4),  # 0 broken lights -> demonstrates ineligible filter
            },
            {
                "segment_code": "GG-HGM-003",
                "name": "Gang Hegarmanah Belakang Pasar",
                "corridor": CorridorEnum.HEGARMANAH,
                "coords": [[107.7758, -6.9365], [107.7771, -6.9374]],
                "obs": (12, 5, 5, 13, 9),
            },
            {
                "segment_code": "GG-SKW-001",
                "name": "Gang Sukawening Indah",
                "corridor": CorridorEnum.SUKAWENING,
                "coords": [[107.7760, -6.9380], [107.7770, -6.9388], [107.7778, -6.9396]],
                "obs": (10, 4, 3, 12, 6),
            },
            {
                "segment_code": "GG-SKW-002",
                "name": "Gang Sukawening Pojok Mahasiswa",
                "corridor": CorridorEnum.SUKAWENING,
                "coords": [[107.7748, -6.9385], [107.7759, -6.9394]],
                "obs": (13, 7, 4, 20, 5),
            },
        ]

        today = date.today()
        for item in sample_segments:
            segment = db.scalar(
                select(AlleySegment).where(
                    AlleySegment.segment_code == item["segment_code"]
                )
            )
            if segment is None:
                segment = AlleySegment(
                    segment_code=item["segment_code"],
                    name=item["name"],
                    corridor=item["corridor"],
                    geojson_geometry={
                        "type": "LineString",
                        "coordinates": item["coords"],
                    },
                    is_active=True,
                )
                db.add(segment)
                db.flush()

            existing_obs = db.scalar(
                select(SegmentObservation).where(
                    SegmentObservation.segment_id == segment.id
                )
            )
            if existing_obs is None:
                total_l, broken_l, crime_c, kost_c, days_ago = item["obs"]
                db.add(
                    SegmentObservation(
                        segment_id=segment.id,
                        total_lights=total_l,
                        broken_lights=broken_l,
                        dawn_crime_count=crime_c,
                        boarding_house_count=kost_c,
                        inspection_date=today - timedelta(days=days_ago),
                        data_source=DataSourceEnum.MANUAL_FORM,
                        updated_by=operator_user.id,
                    )
                )

        # 3. Initial consistent active AHP weight version
        # C1 = Kerusakan Lampu PJU, C2 = Curanmor Dini Hari, C3 = Kepadatan Indekos
        existing_active_ahp = db.scalar(
            select(AHPWeightVersion).where(AHPWeightVersion.is_active.is_(True))
        )
        if existing_active_ahp is None:
            matrix = [
                [1.0, 0.5, 2.0],
                [2.0, 1.0, 3.0],
                [0.5, 1.0 / 3.0, 1.0],
            ]
            ahp_res = calculate_ahp(matrix)
            db.add(
                AHPWeightVersion(
                    version_name="Bobot Pakar Awal Jatinangor v1.0",
                    created_by=penilai_user.id,
                    pairwise_matrix=ahp_res.pairwise_matrix,
                    w_light_damage=ahp_res.w_light_damage,
                    w_dawn_crime=ahp_res.w_dawn_crime,
                    w_boarding_density=ahp_res.w_boarding_density,
                    lambda_max=ahp_res.lambda_max,
                    ci=ahp_res.ci,
                    ri=ahp_res.ri,
                    cr=ahp_res.cr,
                    is_consistent=ahp_res.is_consistent,
                    is_active=True,
                )
            )

        db.commit()
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    seed_database()
    print("Seed database Jatinangor PJU DSS selesai dijalankan.")
