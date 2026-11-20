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
    CycleRankingResult,
    CycleStatus,
    DataSourceEnum,
    EvaluationCycle,
    SegmentObservation,
    User,
    UserRole,
)
from app.services.ahp_engine import calculate_ahp
from app.services.topsis_engine import (
    TOPSISInputItem,
    calculate_topsis,
    evaluate_segment_eligibility,
)


def seed_database(db: Session | None = None) -> None:
    """Populate initial users, 12 Jatinangor alley segments, observations, and active AHP weights."""
    own_session = db is None
    if own_session:
        init_db()
        db = SessionLocal()

    assert db is not None
    try:
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

        # Multi-point OpenStreetMap road centerline coordinates following actual Jatinangor alleys
        sample_segments = [
            {
                "segment_code": "GG-CSK-001",
                "name": "Gang Ciseke Lama Utara",
                "corridor": CorridorEnum.CISEKE,
                "coords": [
                    [107.775007, -6.932916], [107.775035, -6.93302], [107.775082, -6.933118],
                    [107.775136, -6.933196], [107.775187, -6.933245], [107.775226, -6.933294],
                    [107.775271, -6.933348], [107.775332, -6.933425], [107.77543, -6.933538],
                    [107.7755, -6.933632], [107.775578, -6.933728], [107.775626, -6.93385],
                    [107.775648, -6.933969], [107.77564, -6.934063], [107.775663, -6.934152],
                    [107.775691, -6.934223],
                ],
                "obs": (12, 7, 5, 18, 4),
            },
            {
                "segment_code": "GG-CSK-002",
                "name": "Gang Ciseke Baru Selatan",
                "corridor": CorridorEnum.CISEKE,
                "coords": [
                    [107.775691, -6.934223], [107.775847, -6.93423], [107.775951, -6.934214],
                    [107.776109, -6.934195], [107.776292, -6.934182], [107.776433, -6.934201],
                    [107.776545, -6.934252], [107.77666, -6.934285], [107.776706, -6.93431],
                    [107.77684, -6.934383], [107.776987, -6.934476], [107.777084, -6.934589],
                    [107.777196, -6.934728], [107.777307, -6.934875], [107.777321, -6.934899],
                    [107.777358, -6.935079], [107.777364, -6.935156],
                ],
                "obs": (10, 4, 3, 14, 6),
            },
            {
                "segment_code": "GG-CSK-003",
                "name": "Gang Pondokan Ciseke Tengah",
                "corridor": CorridorEnum.CISEKE,
                "coords": [
                    [107.775691, -6.934223], [107.775695, -6.934287], [107.775676, -6.934344],
                    [107.775622, -6.934367], [107.775579, -6.934375], [107.775466, -6.934396],
                    [107.775336, -6.934443], [107.77522, -6.934495], [107.775188, -6.934517],
                    [107.775138, -6.934575], [107.775121, -6.93467], [107.775113, -6.934763],
                    [107.775122, -6.9349],
                ],
                "obs": (8, 5, 4, 22, 8),
            },
            {
                "segment_code": "GG-CRG-001",
                "name": "Gang Caringin Masjid Al-Falah",
                "corridor": CorridorEnum.CARINGIN,
                "coords": [
                    [107.768459, -6.934792], [107.7685, -6.934952], [107.768552, -6.935135],
                    [107.768597, -6.935281], [107.76863, -6.935382], [107.76865, -6.935482],
                    [107.76868, -6.93559], [107.768709, -6.935692], [107.768748, -6.935806],
                    [107.768757, -6.935861], [107.768781, -6.935952], [107.768819, -6.93607],
                    [107.768843, -6.936163], [107.768874, -6.936279], [107.76889, -6.936357],
                    [107.76892, -6.93644], [107.768965, -6.936585], [107.768996, -6.936698],
                    [107.769036, -6.936855], [107.769047, -6.936942], [107.769108, -6.937172],
                    [107.76912, -6.937324], [107.769135, -6.937413], [107.769148, -6.93756],
                    [107.769169, -6.937859], [107.769185, -6.938068], [107.769197, -6.938168],
                    [107.769217, -6.938252],
                ],
                "obs": (14, 8, 6, 16, 3),
            },
            {
                "segment_code": "GG-CRG-002",
                "name": "Gang Caringin Timur Dekat Kolam",
                "corridor": CorridorEnum.CARINGIN,
                "coords": [
                    [107.769879, -6.934554], [107.769879, -6.934565], [107.769916, -6.934722],
                    [107.769972, -6.934862], [107.770622, -6.935716], [107.770754, -6.935922],
                    [107.770784, -6.935986], [107.770796, -6.936035], [107.770823, -6.936214],
                    [107.770906, -6.936589], [107.770912, -6.936627], [107.770885, -6.936648],
                    [107.770754, -6.936724], [107.770741, -6.936803], [107.770759, -6.936866],
                    [107.770843, -6.937062], [107.770911, -6.937244], [107.770948, -6.937313],
                    [107.771004, -6.937422], [107.771106, -6.937364],
                ],
                "obs": (9, 2, 1, 9, 10),
            },
            {
                "segment_code": "GG-GHN-001",
                "name": "Gang H. Nena Utama",
                "corridor": CorridorEnum.GANG_H_NENA,
                "coords": [
                    [107.774057, -6.936249], [107.774325, -6.936303], [107.774557, -6.936332],
                    [107.774707, -6.936331], [107.774828, -6.936321], [107.774941, -6.936302],
                    [107.775157, -6.936261], [107.77524, -6.936254], [107.775272, -6.936262],
                    [107.775307, -6.936271], [107.775392, -6.936384], [107.775481, -6.936505],
                    [107.77549, -6.936515], [107.7755, -6.936523], [107.775515, -6.936523],
                    [107.775534, -6.936519], [107.775675, -6.936484], [107.775711, -6.936495],
                    [107.775733, -6.936512], [107.775746, -6.936526], [107.775837, -6.936619],
                    [107.775892, -6.936649],
                ],
                "obs": (11, 6, 7, 25, 2),
            },
            {
                "segment_code": "GG-GHN-002",
                "name": "Gang H. Nena Cabang Barat",
                "corridor": CorridorEnum.GANG_H_NENA,
                "coords": [
                    [107.775892, -6.936649], [107.775999, -6.936737], [107.776107, -6.936783],
                    [107.776188, -6.936799], [107.776238, -6.936806], [107.77625, -6.93685],
                    [107.776255, -6.93688], [107.776285, -6.936888], [107.776416, -6.936889],
                    [107.776578, -6.936904], [107.776746, -6.936926], [107.777486, -6.937022],
                    [107.777504, -6.937015], [107.777563, -6.936756], [107.777591, -6.936541],
                ],
                "obs": (8, 3, 2, 15, 7),
            },
            {
                "segment_code": "GG-HGM-001",
                "name": "Gang Hegarmanah Jaya 1",
                "corridor": CorridorEnum.HEGARMANAH,
                "coords": [
                    [107.777928, -6.932061], [107.777948, -6.932117], [107.777958, -6.932166],
                    [107.777992, -6.93231], [107.778026, -6.932486], [107.778059, -6.93264],
                    [107.778079, -6.932761], [107.778131, -6.933081], [107.778151, -6.933146],
                    [107.778218, -6.933446], [107.778239, -6.933557], [107.778261, -6.933664],
                    [107.778293, -6.933832], [107.77833, -6.933986], [107.778411, -6.934135],
                    [107.778467, -6.934239], [107.77851, -6.934329], [107.778532, -6.934423],
                    [107.778526, -6.934516], [107.778523, -6.93458], [107.778508, -6.93463],
                    [107.778505, -6.934708], [107.77851, -6.934835], [107.77855, -6.93491],
                    [107.778585, -6.935006], [107.778655, -6.935105],
                ],
                "obs": (15, 6, 4, 19, 5),
            },
            {
                "segment_code": "GG-HGM-002",
                "name": "Gang Hegarmanah Asri 2",
                "corridor": CorridorEnum.HEGARMANAH,
                "coords": [
                    [107.778655, -6.935105], [107.778689, -6.935196], [107.778728, -6.935262],
                    [107.778762, -6.935341], [107.778812, -6.935378], [107.778864, -6.935445],
                    [107.778903, -6.935525], [107.778913, -6.935548], [107.77892, -6.935585],
                    [107.778932, -6.935637], [107.77896, -6.935707], [107.778983, -6.935757],
                    [107.779, -6.93581], [107.779036, -6.935865], [107.779083, -6.935916],
                    [107.779141, -6.935997], [107.779171, -6.936096], [107.779166, -6.93618],
                    [107.779141, -6.936305], [107.779096, -6.936424], [107.779059, -6.936553],
                    [107.779023, -6.936599], [107.779015, -6.936609], [107.77896, -6.936657],
                    [107.778942, -6.936732], [107.778929, -6.936892], [107.778926, -6.936916],
                    [107.778887, -6.937088], [107.778857, -6.937215], [107.778802, -6.937441],
                    [107.778764, -6.937596],
                ],
                "obs": (10, 0, 1, 11, 4),  # 0 broken lights -> demonstrates ineligible filter
            },
            {
                "segment_code": "GG-HGM-003",
                "name": "Gang Hegarmanah Belakang Pasar",
                "corridor": CorridorEnum.HEGARMANAH,
                "coords": [
                    [107.778764, -6.937596], [107.778747, -6.937654], [107.778732, -6.937801],
                    [107.778734, -6.937909], [107.778718, -6.938012], [107.778696, -6.938101],
                    [107.778675, -6.938176], [107.778657, -6.938279], [107.778632, -6.938399],
                    [107.778634, -6.938473], [107.778627, -6.938588], [107.778605, -6.938692],
                    [107.778591, -6.938771], [107.778572, -6.938894], [107.778571, -6.939027],
                    [107.778548, -6.939209], [107.778544, -6.939291], [107.77853, -6.939418],
                    [107.778518, -6.939458], [107.778506, -6.939557], [107.778499, -6.939592],
                    [107.778491, -6.939721], [107.778491, -6.939738], [107.778479, -6.939825],
                ],
                "obs": (12, 5, 5, 13, 9),
            },
            {
                "segment_code": "GG-SKW-001",
                "name": "Gang Sukawening Indah",
                "corridor": CorridorEnum.SUKAWENING,
                "coords": [
                    [107.779352, -6.934401], [107.779362, -6.934425], [107.779376, -6.934532],
                    [107.779358, -6.934717], [107.779354, -6.934989], [107.779362, -6.93509],
                    [107.779382, -6.935114], [107.779438, -6.935118], [107.779516, -6.93512],
                    [107.779698, -6.935118], [107.779843, -6.935118], [107.779873, -6.935124],
                    [107.779889, -6.935132], [107.779894, -6.935166], [107.779894, -6.935221],
                    [107.779917, -6.935348], [107.779943, -6.93544], [107.780006, -6.935495],
                    [107.780048, -6.935475], [107.78013, -6.93547], [107.780292, -6.935462],
                    [107.780496, -6.935437], [107.780651, -6.935413], [107.780813, -6.935393],
                    [107.78094, -6.935409], [107.78116, -6.935389], [107.781301, -6.935363],
                    [107.781393, -6.935329],
                ],
                "obs": (10, 4, 3, 12, 6),
            },
            {
                "segment_code": "GG-SKW-002",
                "name": "Gang Sukawening Pojok Mahasiswa",
                "corridor": CorridorEnum.SUKAWENING,
                "coords": [
                    [107.780006, -6.935495], [107.780005, -6.935526], [107.780009, -6.935617],
                    [107.780016, -6.935904], [107.779997, -6.936129], [107.77996, -6.936288],
                    [107.779936, -6.9364], [107.779927, -6.936418], [107.779922, -6.936421],
                    [107.779917, -6.936422], [107.779808, -6.936441], [107.779721, -6.936441],
                    [107.779575, -6.936454], [107.77949, -6.936464], [107.779458, -6.936471],
                    [107.779433, -6.936494], [107.779414, -6.93653], [107.77937, -6.936641],
                    [107.779351, -6.936657], [107.77932, -6.936662], [107.779104, -6.93663],
                    [107.779023, -6.936599],
                ],
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
            else:
                existing_coords = (segment.geojson_geometry or {}).get("coordinates", [])
                if len(existing_coords) <= 3:
                    segment.geojson_geometry = {
                        "type": "LineString",
                        "coordinates": item["coords"],
                    }

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
            existing_active_ahp = AHPWeightVersion(
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
            db.add(existing_active_ahp)
            db.flush()

        existing_cycle = db.scalar(select(EvaluationCycle).limit(1))
        if existing_cycle is None and existing_active_ahp is not None:
            pju_user = user_map["pju_lead"]
            all_segments = db.scalars(
                select(AlleySegment).order_by(AlleySegment.segment_code.asc())
            ).all()

            eligible_inputs: list[TOPSISInputItem] = []
            snapshots_by_segment: dict[int, dict] = {}
            ineligible_records: list[tuple[AlleySegment, str]] = []

            for seg in all_segments:
                obs = db.scalar(
                    select(SegmentObservation).where(
                        SegmentObservation.segment_id == seg.id
                    )
                )
                is_el, reason = evaluate_segment_eligibility(
                    segment=seg,
                    observation=obs,
                    reference_date=today,
                    expiry_days=90,
                )
                if obs is not None:
                    snapshots_by_segment[seg.id] = {
                        "total_lights": obs.total_lights,
                        "broken_lights": obs.broken_lights,
                        "dawn_crime_count": obs.dawn_crime_count,
                        "boarding_house_count": obs.boarding_house_count,
                        "inspection_date": obs.inspection_date.isoformat(),
                        "data_source": obs.data_source.value,
                    }
                else:
                    snapshots_by_segment[seg.id] = {}

                if is_el and obs is not None and obs.dawn_crime_count is not None:
                    eligible_inputs.append(
                        TOPSISInputItem(
                            segment_id=seg.id,
                            segment_code=seg.segment_code,
                            broken_lights=obs.broken_lights,
                            dawn_crime_count=obs.dawn_crime_count,
                            boarding_house_count=obs.boarding_house_count,
                        )
                    )
                else:
                    ineligible_records.append(
                        (seg, reason or "Tidak memenuhi syarat kelayakan.")
                    )

            if eligible_inputs:
                ranked_items = calculate_topsis(
                    items=eligible_inputs,
                    weights=(
                        existing_active_ahp.w_light_damage,
                        existing_active_ahp.w_dawn_crime,
                        existing_active_ahp.w_boarding_density,
                    ),
                )
                cycle = EvaluationCycle(
                    cycle_name="Siklus Evaluasi Awal Jatinangor",
                    executed_by=pju_user.id,
                    ahp_version_id=existing_active_ahp.id,
                    weights_snapshot={
                        "w_light_damage": existing_active_ahp.w_light_damage,
                        "w_dawn_crime": existing_active_ahp.w_dawn_crime,
                        "w_boarding_density": existing_active_ahp.w_boarding_density,
                        "cr": existing_active_ahp.cr,
                        "version_name": existing_active_ahp.version_name,
                    },
                    status=CycleStatus.RANKED,
                )
                db.add(cycle)
                db.flush()

                for ranked in ranked_items:
                    db.add(
                        CycleRankingResult(
                            cycle_id=cycle.id,
                            segment_id=ranked.segment_id,
                            is_eligible=True,
                            ineligible_reason=None,
                            snapshot_data=snapshots_by_segment[ranked.segment_id],
                            norm_c1=ranked.norm_c1,
                            norm_c2=ranked.norm_c2,
                            norm_c3=ranked.norm_c3,
                            weighted_c1=ranked.weighted_c1,
                            weighted_c2=ranked.weighted_c2,
                            weighted_c3=ranked.weighted_c3,
                            d_plus=ranked.d_plus,
                            d_minus=ranked.d_minus,
                            preference_score=ranked.preference_score,
                            rank=ranked.rank,
                            is_tie_broken=ranked.is_tie_broken,
                        )
                    )

                for seg, reason in ineligible_records:
                    db.add(
                        CycleRankingResult(
                            cycle_id=cycle.id,
                            segment_id=seg.id,
                            is_eligible=False,
                            ineligible_reason=reason,
                            snapshot_data=snapshots_by_segment[seg.id],
                            norm_c1=None,
                            norm_c2=None,
                            norm_c3=None,
                            weighted_c1=None,
                            weighted_c2=None,
                            weighted_c3=None,
                            d_plus=None,
                            d_minus=None,
                            preference_score=None,
                            rank=None,
                            is_tie_broken=False,
                        )
                    )

        db.commit()
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    seed_database()
    print("Seed database Jatinangor PJU DSS selesai dijalankan.")
