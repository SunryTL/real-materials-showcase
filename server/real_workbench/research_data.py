from __future__ import annotations

import json
from pathlib import Path
from typing import Any


PRIORITY_DOIS = [
    {"doi": "10.1111/jace.20497", "route": "Lu–Gd固溶", "priority": "高"},
    {"doi": "10.1016/j.jlumin.2025.121115", "route": "Lu基固溶／Lu–Al–Ga", "priority": "高"},
    {"doi": "10.1016/j.ceramint.2022.09.171", "route": "Gd–Y–ScAG", "priority": "高"},
    {"doi": "10.1016/j.jre.2022.04.029", "route": "YAMSG", "priority": "高"},
    {"doi": "10.1111/jace.70737", "route": "GLMS", "priority": "高"},
    {"doi": "10.26599/jac.2023.9220782", "route": "CSS", "priority": "高"},
    {"doi": "10.1016/j.jlumin.2020.117544", "route": "主流家族补充", "priority": "中"},
    {"doi": "10.1016/j.jallcom.2020.155469", "route": "主流家族补充", "priority": "中"},
    {"doi": "10.1021/jp508409r", "route": "结构／光谱证据", "priority": "中"},
]

WEEKLY_EVIDENCE = {
    "external_ce_rt_rows": 680,
    "external_deduplicated_rows": 671,
    "lee_tasks": [
        {"name": "相对介电常数", "rows": 1349, "hosts": 1224, "r2": 0.870},
        {"name": "质心位移", "rows": 158, "hosts": 152, "r2": 0.878},
        {"name": "最低5d₁", "rows": 358, "hosts": 330, "r2": 0.851},
    ],
    "core_samples": 132,
    "exact_hosts": 59,
    "pdf_files": 13,
    "unique_pdfs": 11,
    "duplicate_groups": 2,
    "priority_dois": 9,
}


def load_project(content_root: Path) -> dict[str, Any]:
    return json.loads((content_root / "project.json").read_text(encoding="utf-8"))


def database_health(content_root: Path, candidate_root: Path) -> dict[str, Any]:
    project = load_project(content_root)
    metrics = project["metrics"]
    packages = [path for path in candidate_root.glob("*/package.yaml")]
    return {
        "version": project["sourceVersion"],
        "audited_on": project["auditedOn"],
        "metrics": metrics,
        "family_counts": [
            {"family": family, "samples": count} for family, count in project["familyCounts"]
        ],
        "descriptor_coverage": [
            {"field": "组成描述符", "count": 132, "total": 132, "source": "化学式统一计算"},
            {"field": "晶格", "count": 116, "total": 132, "source": "论文／结构数据"},
            {"field": "A–O局域结构", "count": 72, "total": 132, "source": "精修或同host CIF代理"},
            {"field": "AO₈体积", "count": 60, "total": 132, "source": "CIF计算"},
            {"field": "畸变指数", "count": 73, "total": 132, "source": "结构数据计算"},
            {"field": "严格PL/PLE", "count": 53, "total": 132, "source": "同样品严格配对"},
        ],
        "model_readiness": [
            {"model": "M0", "ready": metrics["m0Ready"], "total": metrics["coreSamples"], "status": "可启动"},
            {"model": "M1", "ready": metrics["m1Ready"], "total": metrics["coreSamples"], "status": "字段补充中"},
        ],
        "candidate_packages": len(packages),
        "authority_write_enabled": False,
    }
