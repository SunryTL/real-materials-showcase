from pathlib import Path

import json

from fastapi.testclient import TestClient

from real_workbench.app import create_app
from real_workbench.config import Settings
from real_workbench.database import connect


def make_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        runtime_root=tmp_path / "runtime",
        pdf_inbox_root=tmp_path / "inbox",
        candidate_root=tmp_path / "candidates",
        paper_vault_root=tmp_path / "vault",
        research_root=tmp_path / "research",
        initial_admin_username="owner",
        initial_admin_password="correct horse battery staple",
        session_secret="test-secret-with-at-least-32-characters",
    )
    settings.pdf_inbox_root.mkdir(parents=True)
    return TestClient(create_app(settings))


def test_login_scan_deduplicate_and_confirm_doi(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    login = client.post(
        "/api/v1/session/login",
        json={"username": "owner", "password": "correct horse battery staple"},
    )
    assert login.status_code == 200

    pdf_bytes = b"%PDF-1.4\n10.1021/jp508409r\n%%EOF"
    first = client.post(
        "/api/v1/documents",
        files={"files": ("first.pdf", pdf_bytes, "application/pdf")},
    )
    assert first.status_code == 200
    document_id = first.json()["items"][0]["document_id"]

    duplicate = client.post(
        "/api/v1/documents",
        files={"files": ("copy.pdf", pdf_bytes, "application/pdf")},
    )
    assert duplicate.json()["items"][0]["duplicate"] is True

    confirmed = client.patch(
        f"/api/v1/documents/{document_id}",
        json={
            "doi_confirmed": "10.1021/jp508409r",
            "target_family": "YAG",
            "target_fields": ["composition", "PL"],
        },
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["workflow_status"] == "ready_for_extraction"

    dashboard = client.get("/api/v1/dashboard").json()
    assert dashboard["documents"]["unique_pdf"] == 1
    assert dashboard["documents"]["locations"] == 2
    assert dashboard["documents"]["duplicate_groups"] == 1


def test_figure_release_survives_failed_refresh(tmp_path: Path) -> None:
    release = tmp_path / "runtime/database_figures/v-test"
    release.mkdir(parents=True)
    image = release / "figure_01.png"
    image.write_bytes(b"fake-png")
    (release / "statistics").mkdir()
    (release / "statistics/figure_01.csv").write_text("n\n3\n", encoding="utf-8")
    (release / "manifest.json").write_text(
        json.dumps(
            {
                "database_version": "v-test",
                "generated_at_utc": "2026-09-12T00:00:00+00:00",
                "figures": [
                    {
                        "path": "figure_01.png",
                        "statistics": "statistics/figure_01.csv",
                        "sha256": "placeholder",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    (tmp_path / "runtime/database_figures/latest.json").write_text(
        json.dumps({"version": "v-test"}), encoding="utf-8"
    )
    client = make_client(tmp_path)
    client.post(
        "/api/v1/session/login",
        json={"username": "owner", "password": "correct horse battery staple"},
    )

    latest = client.get("/api/v1/figures/releases/latest")
    assert latest.status_code == 200
    assert latest.json()["release_version"] == "v-test"
    assert client.get(
        "/api/v1/figures/releases/v-test/assets/figure_01.png"
    ).content == b"fake-png"

    started = client.post("/api/v1/figures/render")
    assert started.status_code == 200
    assert started.json()["database_version"] == "v1.3_20260725"
    job = client.get(f"/api/v1/figures/jobs/{started.json()['job_id']}").json()
    assert job["status"] == "failed"
    assert "上一正式图集" in job["message"]
    assert client.get("/api/v1/figures/releases/latest").json()["release_version"] == "v-test"


def test_figure_refresh_reports_existing_active_job(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.post("/api/v1/session/login", json={"username": "owner", "password": "correct horse battery staple"})
    with connect(tmp_path / "runtime/real_workbench.db") as connection:
        cursor = connection.execute("INSERT INTO figure_jobs(status,stage,progress,message,database_version,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", ("running", "rendering", 35, "rendering", "v1.3", 1, "now", "now"))
        active_id = cursor.lastrowid
    response = client.post("/api/v1/figures/render")
    assert response.status_code == 409
    assert response.json()["detail"]["job_id"] == active_id
    with connect(tmp_path / "runtime/real_workbench.db") as connection:
        assert connection.execute("SELECT COUNT(*) FROM figure_jobs").fetchone()[0] == 1
