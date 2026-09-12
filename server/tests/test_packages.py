from pathlib import Path

from real_workbench.packages import SEVEN_TABLE_NAMES, write_candidate_package


def test_candidate_package_uses_the_existing_seven_table_contract(tmp_path: Path) -> None:
    schema_path = Path(__file__).parent / "fixtures" / "seven_table_schema.json"
    schema_path.parent.mkdir(parents=True, exist_ok=True)
    schema_path.write_text(
        '{"schema_version":"1.0","tables":{'
        '"sample_master":["sample_id","full_formula"],'
        '"site_occupancy":["occupancy_id","sample_id"],'
        '"optical_measurement":["measurement_id","sample_id"],'
        '"ceramic_process":["process_id","sample_id"],'
        '"crystal_structure":["structure_id","sample_id"],'
        '"physical_descriptors":["descriptor_id","sample_id"],'
        '"data_source":["source_id","sample_id"]}}',
        encoding="utf-8",
    )
    payload = {
        "tables": {
            "sample_master": [{"sample_id": "PAPER_S001", "full_formula": "Y3Al5O12:Ce"}],
            **{name: [] for name in SEVEN_TABLE_NAMES if name != "sample_master"},
        },
        "field_evidence": [],
        "grouping_review": [],
        "admission_summary": "等待人工审核",
    }

    package = write_candidate_package(
        output_root=tmp_path / "candidate_extractions",
        schema_path=schema_path,
        doi="10.1000/test",
        pdf_sha256="a" * 64,
        target_family="YAG",
        target_fields=["composition", "PL"],
        payload=payload,
        model="test-model",
        prompt_version="test-v1",
    )

    assert package.name == "10.1000_test"
    assert (package / "package.yaml").exists()
    assert (package / "extraction_review.xlsx").exists()
    assert {path.stem for path in (package / "tables").glob("*.csv")} == set(SEVEN_TABLE_NAMES)
