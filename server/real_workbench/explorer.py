"""Private, versioned statistics and owner-gated snapshot publication."""
from __future__ import annotations
import hashlib
import json
import os
import shutil
import subprocess
import uuid
from datetime import datetime,timezone
from pathlib import Path
from .database import connect
from .packages import read_package

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def package_hash(package: Path):
    files=sorted([*package.glob('tables/*.csv'),*package.glob('audit/*.csv'),*package.glob('package.yaml')])
    return hashlib.sha256(json.dumps([(str(p.relative_to(package)),digest(p)) for p in files]).encode()).hexdigest()

def publication_inputs(package: Path,decision: str):
    before=package_hash(package)
    report=json.loads((package/'validation_report.json').read_text())
    if not report.get('valid') or report.get('status')!='candidate_ready_for_human_review':
        raise ValueError('必须通过论文库完整校验，文件存在性检查不能发布')
    if report.get('validated_package_sha256')!=package_hash(package):
        raise ValueError('校验后候选表已修改或尚未绑定校验哈希，请重新校验')
    if decision not in {'core_candidate','auxiliary'}: raise ValueError('需要负责人完成核心或辅助准入审核')
    payload=read_package(package)
    if not payload['tables']['sample_master']: raise ValueError('候选包没有样品')
    if decision=='core_candidate':
        optical=payload['tables']['optical_measurement']
        eligible=set()
        for row in optical:
            try: peak=float(row.get('emission_peak_nm',''))
            except (ValueError,TypeError): continue
            if str(row.get('room_temperature_flag','')).lower() in {'true','1','yes'} and 0<peak<float('inf'):
                eligible.add(row['sample_id'])
        for row in payload['tables']['sample_master']:
            if 'ceramic' not in str(row.get('material_form','')).lower() or row['sample_id'] not in eligible:
                raise ValueError('核心准入必须逐条确认陶瓷形态和明确室温PL，其他记录请选择辅助层')
    if package_hash(package)!=before: raise ValueError('读取期间候选数据发生变化，请重新审核')
    return {'tables':payload['tables'],'decision':decision,'status':'formal','package_sha256':before}

def versions(settings):
    root=settings.runtime_root/'database_snapshots'
    return ['baseline',*sorted([p.parent.name for p in root.glob('r-*/manifest.json')],reverse=True)]

def snapshot(settings,version='latest'):
    root=settings.runtime_root/'database_snapshots'
    if version=='latest':
        pointer=root/'latest.json'
        version=json.loads(pointer.read_text())['version'] if pointer.exists() else 'baseline'
    if version=='baseline': return {'version':'baseline','overlays':[]},settings.snapshot_root,settings.authority_workbook
    if version not in versions(settings): raise ValueError('数据库版本不存在')
    manifest=json.loads((root/version/'manifest.json').read_text())
    base=root/manifest['base_dir']
    return manifest,base/'snapshot',base/'authority.xlsx'

def _candidate_overlays(settings,used):
    with connect(settings.database_path) as db:
        rows=db.execute("SELECT j.id,j.package_path,(SELECT decision FROM package_reviews r WHERE r.job_id=j.id ORDER BY r.id DESC LIMIT 1) decision FROM jobs j WHERE j.status='candidate_ready' AND j.package_path IS NOT NULL ORDER BY j.id DESC").fetchall()
    result=[]; seen=set()
    for row in rows:
        if row['id'] in used or row['package_path'] in seen or row['decision']=='exclude':continue
        seen.add(row['package_path'])
        path=(settings.candidate_root/row['package_path']).resolve()
        if settings.candidate_root.resolve() not in path.parents: continue
        payload=read_package(path)
        result.append({'tables':payload['tables'],'decision':'pending','status':'candidate','job_id':row['id']})
    return result

def calculate(settings, *, version='latest', family='', material_form='', status='formal', override=None):
    if status not in {'formal','candidate','all'}:raise ValueError('筛选状态无效')
    manifest,source,workbook=snapshot(settings,version)
    overlays=list(manifest.get('overlays',[])) if override is None else override
    if status!='formal':overlays+=_candidate_overlays(settings,{p.get('job_id') for p in overlays})
    if not workbook or not workbook.exists():raise FileNotFoundError('未配置可读取的权威数据库')
    python=settings.pubfig_python
    if not python or not python.exists():raise FileNotFoundError('未配置科研统计Python环境')
    modules=sorted((settings.research_root/'research/code/reporting').glob('*.py'))
    inputs=[workbook,*[source/p for p in ['database_summary.json','core_collaboration_snapshot.csv','family_coverage_index.csv','m0_v1/training.csv']],*modules]
    source_hashes={str(p):digest(p) for p in inputs}
    identity={'files':source_hashes,'overlays':overlays,'family':family,'material_form':material_form,'status':status,'version':manifest['version']}
    fingerprint=hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest()
    root=settings.runtime_root/'explorer_cache';root.mkdir(parents=True,exist_ok=True)
    cached=root/f'{fingerprint}.json'
    if not cached.exists():
        token=uuid.uuid4().hex;request=root/f'.{token}.overlays.json';result=root/f'.{token}.result.json'
        request.write_text(json.dumps(overlays,ensure_ascii=False))
        command=[str(python),'-m','research.code.reporting.explorer','--snapshot-root',str(source),'--authority-workbook',str(workbook),'--overlays',str(request),'--output',str(result),'--family',family,'--material-form',material_form,'--status',status,'--version',manifest['version']]
        try:
            process=subprocess.run(command,cwd=settings.research_root,env={**os.environ,'PYTHONPATH':str(settings.research_root)},capture_output=True,text=True,timeout=120)
            if process.returncode:raise ValueError((process.stderr or '统计生成失败')[-1500:])
            if any(digest(p)!=h for p,h in source_hashes.items()):raise ValueError('计算期间源数据发生变化，请刷新重试')
            json.loads(result.read_text())
            result.replace(cached)
        finally:
            request.unlink(missing_ok=True);result.unlink(missing_ok=True)
    payload=json.loads(cached.read_text())
    payload['options']['versions']=versions(settings)
    payload['source_hash']=fingerprint
    selected={r['sample_id'] for r in payload['records']}
    payload['candidate_jobs']=[{'job_id':p.get('job_id'),'samples':len(p['tables'].get('sample_master',[])), 'matched_samples':sum(r['sample_id'] in selected for r in p['tables'].get('sample_master',[]))} for p in overlays if p.get('status')=='candidate' and any(r['sample_id'] in selected for r in p['tables'].get('sample_master',[]))]
    payload['status_counts']={status:sum(r['status']==status for r in payload['records']) for status in ['formal','candidate']}
    return payload

def publish(settings,job_ids,owner_id):
    import fcntl
    root=settings.runtime_root/'database_snapshots';root.mkdir(parents=True,exist_ok=True)
    with (root/'.publish.lock').open('a') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError as e:raise ValueError('已有发布任务，请稍后重试') from e
        manifest,source,workbook=snapshot(settings)
        overlays=list(manifest.get('overlays',[])); used={p.get('job_id') for p in overlays}
        with connect(settings.database_path) as db:
            for job_id in sorted(set(job_ids)):
                if job_id in used: raise ValueError('所选候选包已发布')
                row=db.execute('SELECT package_path FROM jobs WHERE id=?',(job_id,)).fetchone()
                review=db.execute('SELECT decision,reviewed_package_sha256 FROM package_reviews WHERE job_id=? ORDER BY id DESC LIMIT 1',(job_id,)).fetchone()
                if not row or not row['package_path'] or not review:raise ValueError('候选包尚未完成负责人审核')
                path=(settings.candidate_root/row['package_path']).resolve()
                if settings.candidate_root.resolve() not in path.parents:raise ValueError('候选包路径越界')
                content=publication_inputs(path,review['decision'])
                if not review['reviewed_package_sha256'] or review['reviewed_package_sha256']!=content.get('package_sha256'):
                    raise ValueError('候选表与负责人审核版本不一致，请重新审核')
                overlays.append({**content,'job_id':job_id})
        source_files=[workbook,source/'database_summary.json',source/'core_collaboration_snapshot.csv',source/'family_coverage_index.csv',source/'m0_v1/training.csv']
        source_hashes=[digest(p) for p in source_files]
        # Execute the same real statistic pipeline before moving the formal pointer.
        calculate(settings,status='formal',override=overlays)
        if [digest(p) for p in source_files]!=source_hashes: raise ValueError('发布期间基础数据变化，请重试')
        source_digest=hashlib.sha256(''.join(source_hashes).encode()).hexdigest()
        base_name='base-'+source_digest[:16];base=root/base_name
        if not base.exists():
            temp=root/('.base-'+uuid.uuid4().hex);(temp/'snapshot/m0_v1').mkdir(parents=True)
            shutil.copyfile(workbook,temp/'authority.xlsx')
            for name in ['database_summary.json','core_collaboration_snapshot.csv','family_coverage_index.csv','m0_v1/training.csv']:
                shutil.copyfile(source/name,temp/'snapshot'/name)
            copied=[temp/'authority.xlsx',*[temp/'snapshot'/name for name in ['database_summary.json','core_collaboration_snapshot.csv','family_coverage_index.csv','m0_v1/training.csv']]]
            if [digest(p) for p in copied]!=source_hashes: raise ValueError('快照复制校验失败，旧版本仍有效')
            temp.rename(base)
        version='r-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+uuid.uuid4().hex[:6]
        destination=root/version;destination.mkdir()
        payload={'version':version,'parent':manifest['version'],'base_dir':base_name,'overlays':overlays,'created_by':owner_id,'created_at':datetime.now(timezone.utc).isoformat(),'base_sha256':source_digest}
        (destination/'manifest.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2))
        temp=root/('.latest-'+uuid.uuid4().hex);temp.write_text(json.dumps({'version':version}));temp.replace(root/'latest.json')
        return {'version':version,'authority_database_changed':False,'published_jobs':job_ids}
