from __future__ import annotations

import json
import os
import re
import subprocess
import hashlib
import uuid
import tempfile
import fcntl
from pathlib import Path
from typing import Any

from .config import Settings


def safe_version(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip("-.")
    if not cleaned:
        raise ValueError("数据库版本为空")
    return cleaned


def database_release_version(source_version: str) -> str:
    """Derive a compact figure-release id from the audited workbook label."""
    stem = Path(source_version).stem
    match = re.search(r"v\d+(?:\.\d+)+(?:_\d{8})?", stem, flags=re.IGNORECASE)
    return safe_version(match.group(0) if match else stem)


def _latest_pointer(root: Path) -> Path:
    return root / "latest.json"


def release_root(settings: Settings, version: str) -> Path | None:
    safe = safe_version(version)
    for root in (settings.figure_release_root, settings.bundled_figure_root):
        candidate = (root / safe).resolve()
        if candidate.parent == root.resolve() and (candidate / "manifest.json").exists():
            return candidate
    return None


def latest_release(settings: Settings) -> dict[str, Any]:
    for root in (settings.figure_release_root, settings.bundled_figure_root):
        pointer = _latest_pointer(root)
        if not pointer.exists():
            continue
        version = json.loads(pointer.read_text(encoding="utf-8"))["version"]
        release = release_root(settings, version)
        if release is not None:
            payload = json.loads((release / "manifest.json").read_text(encoding="utf-8"))
            payload["release_version"] = version
            payload["asset_base_url"] = f"/api/v1/figures/releases/{version}/assets"
            return payload
    raise FileNotFoundError("尚未发布数据库科研图")


def manifest_for(settings: Settings, version: str) -> dict[str, Any]:
    release = release_root(settings, version)
    if release is None:
        raise FileNotFoundError(version)
    payload = json.loads((release / "manifest.json").read_text(encoding="utf-8"))
    payload["release_version"] = safe_version(version)
    payload["asset_base_url"] = f"/api/v1/figures/releases/{safe_version(version)}/assets"
    return payload


def resolve_asset(settings: Settings, version: str, relative_path: str) -> Path:
    release = release_root(settings, version)
    if release is None:
        raise FileNotFoundError(version)
    target = (release / relative_path).resolve()
    if target != release and release not in target.parents:
        raise ValueError("资源路径越界")
    if not target.is_file():
        raise FileNotFoundError(relative_path)
    return target


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _inputs(settings: Settings) -> dict:
    names = {"database_summary":"database_summary.json", "core_snapshot":"core_collaboration_snapshot.csv", "m0_training":"m0_v1/training.csv", "family_index":"family_coverage_index.csv"}
    sources = {k:_digest(settings.snapshot_root/v) for k,v in names.items()}
    sources['authority_workbook'] = _digest(settings.authority_workbook)
    folder = settings.research_root/'research/code/reporting'
    code = {str(p.relative_to(settings.research_root)):_digest(p) for p in sorted(folder.iterdir()) if p.is_file() and p.suffix in {'.py','.md','.png'}}
    return {'source_sha256':sources,'renderer_sha256':code}


def _verify(path: Path, version: str, identity: dict) -> dict:
    payload = json.loads(path.read_text())
    if payload.get('database_version') != version or payload.get('source_sha256') != identity['source_sha256']:
        raise ValueError('图集版本或来源哈希不匹配')
    if not payload.get('figures'): raise ValueError('图集为空')
    for entry in [*payload['figures'], *([payload['point_cloud']] if payload.get('point_cloud') else [])]:
        for key, hashkey in [('path','sha256'),('statistics','statistics_sha256')]:
            target = (path.parent/entry[key]).resolve()
            if path.parent.resolve() not in target.parents or not target.is_file(): raise ValueError('图集资源缺失或路径越界')
            actual = _digest(target)
            if entry.get(hashkey) and entry[hashkey] != actual: raise ValueError('图集资源校验失败')
            entry[hashkey] = actual
    return payload


def render_release(settings: Settings, database_version: str) -> Path:
    settings.figure_release_root.mkdir(parents=True, exist_ok=True)
    with (settings.figure_release_root/'.render.lock').open('a') as lock:
        try: fcntl.flock(lock, fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError as error: raise RuntimeError('已有绘图任务正在进行') from error
        identity = _inputs(settings)
        key = hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest()[:16]
        version = safe_version(database_version)+'-'+key
        final = settings.figure_release_root/version/'manifest.json'
        if final.exists():
            _verify(final,version,identity)
        else:
            with tempfile.TemporaryDirectory(prefix='.render-',dir=settings.figure_release_root) as temporary:
                manifest = _render(settings,version,Path(temporary))
                payload = _verify(manifest,version,identity)
                if _inputs(settings) != identity: raise ValueError('绘图期间数据库发生变化，未发布')
                payload['release_provenance'] = identity
                manifest.write_text(json.dumps(payload,ensure_ascii=False,indent=2))
                manifest.parent.rename(final.parent)
        pointer = settings.figure_release_root/('.latest-'+uuid.uuid4().hex)
        pointer.write_text(json.dumps({'version':version,'manifest_sha256':_digest(final)}))
        pointer.replace(_latest_pointer(settings.figure_release_root))
        return final


def _render(settings: Settings, database_version: str, output_root: Path) -> Path:
    if settings.authority_workbook is None or not settings.authority_workbook.exists():
        raise FileNotFoundError("未找到权威数据库Excel，请设置REAL_AUTHORITY_WORKBOOK")
    if settings.pubfig_python is None or not settings.pubfig_python.exists():
        raise FileNotFoundError("未找到real-materials-pubfig解释器，请设置REAL_PUBFIG_PYTHON")
    renderer = settings.research_root / "research/code/reporting/database_atlas.py"
    if not renderer.exists():
        raise FileNotFoundError("科研主库尚未包含database_atlas.py")
    version = safe_version(database_version)
    previous: Path | None = None
    try:
        previous_payload = latest_release(settings)
        previous_root = release_root(settings, previous_payload["release_version"])
        previous = previous_root / "manifest.json" if previous_root else None
    except FileNotFoundError:
        pass
    command = [
        str(settings.pubfig_python),
        "-m",
        "research.code.reporting.database_atlas",
        "--snapshot-root",
        str(settings.snapshot_root),
        "--authority-workbook",
        str(settings.authority_workbook),
        "--output-root",
        str(output_root),
        "--database-version",
        version,
        "--minimum-width-px",
        "4200",
    ]
    if previous and previous.exists() and previous.parent.name != version:
        command.extend(["--previous-manifest", str(previous)])
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(settings.research_root)
    completed = subprocess.run(command, cwd=settings.research_root, env=environment, capture_output=True, text=True, timeout=600, check=False)
    manifest = output_root / version / "manifest.json"
    if completed.returncode != 0 or not manifest.exists():
        raise RuntimeError((completed.stderr or completed.stdout or "科研图生成失败")[-3000:])
    return manifest
