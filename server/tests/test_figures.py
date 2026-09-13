from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import threading
from pathlib import Path

import pytest

from real_workbench.config import Settings
from real_workbench.figures import render_release, resolve_asset


SOURCE_FILES = {
    "database_summary": "database_summary.json",
    "core_snapshot": "core_collaboration_snapshot.csv",
    "m0_training": "m0_v1/training.csv",
    "family_index": "family_coverage_index.csv",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.fixture
def figure_settings(tmp_path: Path) -> Settings:
    settings = Settings(
        runtime_root=tmp_path / "runtime", pdf_inbox_root=tmp_path / "inbox",
        candidate_root=tmp_path / "candidates", paper_vault_root=tmp_path / "vault",
        research_root=tmp_path / "research", authority_workbook=tmp_path / "authority.xlsx",
        pubfig_python=Path(sys.executable), session_secret="figure-test-secret",
    )
    settings.prepare()
    settings.authority_workbook.write_bytes(b"audited workbook")
    for relative in SOURCE_FILES.values():
        path = settings.snapshot_root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("original source", encoding="utf-8")
    reporting = settings.research_root / "research/code/reporting"
    reporting.mkdir(parents=True)
    for name in ("database_atlas.py", "master_preview.py", "master_style.py", "point_cloud.py", "JOURNAL_DATABASE_STYLE.md", "STYLE_MASTER_IMAGEGEN.png"):
        (reporting / name).write_text("original renderer", encoding="utf-8")
    return settings


def render_stub(settings: Settings, command: list[str], **kwargs: object) -> subprocess.CompletedProcess:
    """Replace only the expensive external plot process, retaining on-disk IO."""
    del kwargs
    version = command[command.index("--database-version") + 1]
    output = Path(command[command.index("--output-root") + 1]) / version
    output.mkdir(parents=True, exist_ok=True)
    source_hashes = {name: digest(settings.snapshot_root / relative) for name, relative in SOURCE_FILES.items()}
    source_hashes["authority_workbook"] = digest(settings.authority_workbook)
    image = output / "figure_01.png"
    # Bytes vary with source/code, so stale-directory reuse is observable.
    image.write_bytes(b"\x89PNG\r\n\x1a\n" + settings.authority_workbook.read_bytes() + (settings.research_root / "research/code/reporting/master_style.py").read_bytes())
    (output / "statistics").mkdir(exist_ok=True)
    (output / "statistics/figure_01.csv").write_text("n\n3\n", encoding="utf-8")
    manifest = {"schema_version": 1, "database_version": version, "generated_at_utc": "2026-09-12T00:00:00+00:00", "style_contract": "master-v2", "source_sha256": source_hashes, "figures": [{"id": "figure_01", "path": "figure_01.png", "statistics": "statistics/figure_01.csv", "sha256": digest(image)}]}
    (output / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return subprocess.CompletedProcess(command, 0, stdout=str(output / "manifest.json"), stderr="")


@pytest.mark.parametrize("changed", ["authority", *SOURCE_FILES.values(), "master_preview.py", "master_style.py", "database_atlas.py", "point_cloud.py", "JOURNAL_DATABASE_STYLE.md", "STYLE_MASTER_IMAGEGEN.png"])
def test_content_change_gets_new_immutable_release(figure_settings: Settings, monkeypatch: pytest.MonkeyPatch, changed: str) -> None:
    settings = figure_settings
    monkeypatch.setattr("real_workbench.figures.subprocess.run", lambda *args, **kwargs: render_stub(settings, *args, **kwargs))
    first = render_release(settings, "v1.3_20260725")
    first_bytes = first.read_bytes()
    if changed == "authority":
        path = settings.authority_workbook
    elif changed in SOURCE_FILES.values():
        path = settings.snapshot_root / changed
    else:
        path = settings.research_root / "research/code/reporting" / changed
    path.write_bytes(b"changed content")
    second = render_release(settings, "v1.3_20260725")
    assert second != first
    assert first.read_bytes() == first_bytes
    payload = json.loads(second.read_text())
    assert payload["source_sha256"]["authority_workbook"] == digest(settings.authority_workbook)
    assert payload["release_provenance"]["renderer_sha256"]["research/code/reporting/master_style.py"] == digest(settings.research_root / "research/code/reporting/master_style.py")
    pointer = json.loads((settings.figure_release_root / "latest.json").read_text())
    assert pointer["version"] == second.parent.name
    assert pointer["manifest_sha256"] == digest(second)


def test_unchanged_inputs_reuse_verified_release_without_rerender(figure_settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
    settings = figure_settings
    monkeypatch.setattr("real_workbench.figures.subprocess.run", lambda *args, **kwargs: render_stub(settings, *args, **kwargs))
    first = render_release(settings, "v1.3")
    before = first.read_bytes()
    def should_not_render(*args: object, **kwargs: object) -> None:
        pytest.fail("unchanged inputs must reuse their audited release")
    monkeypatch.setattr("real_workbench.figures.subprocess.run", should_not_render)
    assert render_release(settings, "v1.3") == first
    assert first.read_bytes() == before


@pytest.mark.parametrize("failure", ["missing_png", "missing_statistics", "bad_png_checksum", "bad_statistics_checksum", "bad_source_checksum", "wrong_version", "empty_figures", "escaped_asset", "symlink_asset", "missing_point_cloud", "bad_point_cloud_checksum", "missing_point_cloud_statistics"])
def test_invalid_completed_render_does_not_replace_latest(figure_settings: Settings, monkeypatch: pytest.MonkeyPatch, failure: str) -> None:
    settings = figure_settings
    pointer = settings.figure_release_root / "latest.json"
    pointer.write_text('{"version":"prior-release"}', encoding="utf-8")
    def broken_render(command: list[str], **kwargs: object) -> subprocess.CompletedProcess:
        result = render_stub(settings, command, **kwargs)
        manifest_path = Path(result.stdout)
        output = manifest_path.parent
        payload = json.loads(manifest_path.read_text())
        figure = payload["figures"][0]
        if failure == "missing_png":
            (output / figure["path"]).unlink()
        elif failure == "missing_statistics":
            (output / figure["statistics"]).unlink()
        elif failure == "bad_png_checksum":
            figure["sha256"] = "0" * 64
        elif failure == "bad_statistics_checksum":
            figure["statistics_sha256"] = "0" * 64
        elif failure == "bad_source_checksum":
            payload["source_sha256"]["authority_workbook"] = "0" * 64
        elif failure == "wrong_version":
            payload["database_version"] = "wrong"
        elif failure == "empty_figures":
            payload["figures"] = []
        elif failure in {"escaped_asset", "symlink_asset"}:
            outside = settings.runtime_root / "outside.png"
            outside.write_bytes(b"private")
            figure["sha256"] = digest(outside)
            if failure == "escaped_asset":
                figure["path"] = str(outside)
            else:
                (output / figure["path"]).unlink()
                (output / figure["path"]).symlink_to(outside)
        else:
            cloud = output / "point_cloud.json"
            cloud.write_text('{"points":[]}', encoding="utf-8")
            payload["point_cloud"] = {"path": "point_cloud.json", "sha256": digest(cloud), "statistics": figure["statistics"], "count": 0}
            if failure == "missing_point_cloud":
                cloud.unlink()
            elif failure == "bad_point_cloud_checksum":
                payload["point_cloud"]["sha256"] = "0" * 64
            else:
                payload["point_cloud"]["statistics"] = "missing.csv"
        manifest_path.write_text(json.dumps(payload), encoding="utf-8")
        return result
    monkeypatch.setattr("real_workbench.figures.subprocess.run", broken_render)
    with pytest.raises((RuntimeError, ValueError, FileNotFoundError)):
        render_release(settings, "v1.3")
    assert pointer.read_text() == '{"version":"prior-release"}'
    assert not list(settings.figure_release_root.glob("v1.3*/manifest.json"))


def test_source_mutation_during_render_is_not_published(figure_settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
    settings = figure_settings
    def mutating_render(command: list[str], **kwargs: object) -> subprocess.CompletedProcess:
        result = render_stub(settings, command, **kwargs)
        settings.authority_workbook.write_bytes(b"updated during render")
        return result
    monkeypatch.setattr("real_workbench.figures.subprocess.run", mutating_render)
    with pytest.raises((RuntimeError, ValueError)):
        render_release(settings, "v1.3")
    assert not (settings.figure_release_root / "latest.json").exists()


def test_corrupt_cached_release_is_not_republished(figure_settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
    settings = figure_settings
    monkeypatch.setattr("real_workbench.figures.subprocess.run", lambda *args, **kwargs: render_stub(settings, *args, **kwargs))
    manifest = render_release(settings, "v1.3")
    pointer = settings.figure_release_root / "latest.json"
    before = pointer.read_bytes()
    (manifest.parent / "figure_01.png").write_bytes(b"tampered")
    with pytest.raises((RuntimeError, ValueError)):
        render_release(settings, "v1.3")
    assert pointer.read_bytes() == before


def test_concurrent_render_is_rejected_without_touching_first_staging(figure_settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
    settings = figure_settings
    started = threading.Event()
    finish = threading.Event()
    errors: list[Exception] = []
    def slow_render(command: list[str], **kwargs: object) -> subprocess.CompletedProcess:
        result = render_stub(settings, command, **kwargs)
        started.set()
        assert finish.wait(timeout=5)
        assert Path(result.stdout).exists()
        return result
    monkeypatch.setattr("real_workbench.figures.subprocess.run", slow_render)
    def first_render() -> None:
        try:
            render_release(settings, "v1.3")
        except Exception as error:
            errors.append(error)
    worker = threading.Thread(target=first_render)
    worker.start()
    assert started.wait(timeout=5)
    try:
        with pytest.raises(RuntimeError, match="正在|running|进行"):
            render_release(settings, "v1.3")
    finally:
        finish.set()
        worker.join(timeout=5)
    assert not errors


def test_asset_resolution_rejects_symlink_escape(figure_settings: Settings) -> None:
    settings = figure_settings
    release = settings.figure_release_root / "v-test"
    release.mkdir()
    (release / "manifest.json").write_text("{}", encoding="utf-8")
    (release / "outside.png").symlink_to(settings.authority_workbook)
    with pytest.raises(ValueError):
        resolve_asset(settings, "v-test", "outside.png")
