from pathlib import Path

from fastapi.testclient import TestClient

from real_workbench.app import create_app
from real_workbench.config import Settings


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
