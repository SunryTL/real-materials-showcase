"""Local append-only review history; no writes to scientific inputs."""
import json
import math
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def save_decision(root: Path, sample_id: str, decision: str, reason: str,
                  provenance: dict, reviewer_id: int, known_ids: set, correction: dict | None = None) -> dict:
    if sample_id not in known_ids:
        raise ValueError('样品编号不在当前审核范围')
    if decision not in {'keep', 'check', 'propose_correction'}:
        raise ValueError('不支持的审核决定')
    if not reason.strip() or len(reason)>4000:
        raise ValueError('请填写1至4000字的审核理由')
    if correction is not None:
        units={'pl_peak_nm':'nm','ple_peak_nm':'nm','thickness_mm':'mm','annealing_temperature_c':'°C'}
        if not isinstance(correction,dict) or decision!='propose_correction':
            raise ValueError('数值修改必须选择建议修正')
        if correction.get('field') not in units or correction.get('unit')!=units[correction['field']]:
            raise ValueError('修改字段或单位不正确')
        for key in ('old_value','new_value'):
            val=correction.get(key)
            if key=='old_value' and val is None:
                continue
            if isinstance(val,bool) or not isinstance(val,(int,float)) or not math.isfinite(val) or val<=0:
                raise ValueError('请填写有限正数；原值缺失时可留空')
        if not isinstance(correction.get('evidence'),str) or not correction['evidence'].strip() or len(correction['evidence'])>4000:
            raise ValueError('请填写原文图表或测量依据')
    record=dict(id=str(uuid4()),sample_id=sample_id,decision=decision,
                reason=reason.strip(),provenance=provenance,reviewer_id=reviewer_id,
                created_at=datetime.now(timezone.utc).isoformat(),status='review_only')
    if correction is not None:
        record['correction']={key:correction[key] for key in ('field','new_value','unit','evidence')}
        record['correction']['old_value']=correction.get('old_value')
        record['correction_old_value_source']='reviewer_entered_pending_verification'
    root.mkdir(parents=True,exist_ok=True)
    with sqlite3.connect(root/'model_reviews.sqlite3') as db:
        db.execute('CREATE TABLE IF NOT EXISTS decisions (seq INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL)')
        db.execute('INSERT INTO decisions(payload) VALUES (?)',(json.dumps(record,ensure_ascii=False,allow_nan=False),))
    return record


def read_decisions(root: Path) -> list:
    path=root/'model_reviews.sqlite3'
    if not path.exists():
        return []
    with sqlite3.connect(f'{path.as_uri()}?mode=ro',uri=True) as db:
        return [json.loads(row[0]) for row in db.execute('SELECT payload FROM decisions ORDER BY seq')]


def candidate_package(root: Path, identifiers: list, provenance: dict) -> dict:
    """Export explicitly selected proposals without mutating any source or history."""
    if not isinstance(identifiers,list) or not identifiers or any(not isinstance(i,str) for i in identifiers):
        raise ValueError('请选择待导出的修改建议')
    if len(set(identifiers))!=len(identifiers):
        raise ValueError('重复选择了修改建议')
    lookup={r['id']:r for r in read_decisions(root)}
    changes=[];fields=set()
    for identifier in identifiers:
        record=lookup.get(identifier)
        if not record or record.get('decision')!='propose_correction' or not record.get('correction'):
            raise ValueError('所选记录不是有效数值修改建议')
        if record['provenance']!=provenance:
            raise ValueError('数据版本已变化，请重新核对修改建议')
        key=(record['sample_id'],record['correction']['field'])
        if key in fields:
            raise ValueError('同一样品的同一字段只能选择一项修改建议')
        fields.add(key);changes.append(record)
    return dict(schema_version=1,status='candidate_not_applied',
                created_at=datetime.now(timezone.utc).isoformat(),
                provenance=provenance,changes=changes,
                authority_database_changed=False)
