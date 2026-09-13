from pathlib import Path
import pytest
from test_api import make_client
from real_workbench.explorer import package_hash, publication_inputs

def test_publication_is_immutable_and_failure_keeps_pointer(tmp_path, monkeypatch):
    import json
    from real_workbench.config import Settings
    from real_workbench.database import init_database, connect
    from real_workbench.explorer import publish, snapshot
    s=Settings(runtime_root=tmp_path/'run',pdf_inbox_root=tmp_path/'in',candidate_root=tmp_path/'candidates',paper_vault_root=tmp_path/'vault',research_root=tmp_path/'research',authority_workbook=tmp_path/'source.xlsx')
    s.prepare();init_database(s.database_path)
    s.authority_workbook.write_bytes(b'unchanged-authority')
    for name in ['database_summary.json','core_collaboration_snapshot.csv','family_coverage_index.csv','m0_v1/training.csv']:
        p=s.snapshot_root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('fixture')
    with connect(s.database_path) as db:
        db.execute("INSERT INTO users VALUES(1,'test','test','hash','owner',1,'now')")
        db.execute("INSERT INTO documents(id,sha256,size_bytes,canonical_filename,created_by,created_at,updated_at) VALUES(1,'sha',1,'fixture.pdf',1,'now','now')")
        db.execute("INSERT INTO jobs(id,document_id,status,stage,package_path,created_by,created_at,updated_at) VALUES(1,1,'candidate_ready','ready','fixture',1,'now','now')")
        db.execute("INSERT INTO package_reviews(job_id,reviewer_id,decision,created_at,reviewed_package_sha256) VALUES(1,1,'auxiliary','now','fixture-hash')")
    monkeypatch.setattr('real_workbench.explorer.publication_inputs',lambda *_: {'package_sha256':'edited-after-owner-review'})
    with pytest.raises(ValueError,match='重新审核'): publish(s,[1],1)
    assert not (s.runtime_root/'database_snapshots/latest.json').exists()
    monkeypatch.setattr('real_workbench.explorer.publication_inputs',lambda *_: {'tables':{'sample_master':[{'sample_id':'new'}]},'status':'formal','decision':'auxiliary','package_sha256':'fixture-hash'})
    monkeypatch.setattr('real_workbench.explorer.calculate',lambda *_,**__: {'summary':{'samples':1}})
    result=publish(s,[1],1)
    manifest,base,workbook=snapshot(s)
    assert manifest['version']==result['version']
    assert workbook.read_bytes()==b'unchanged-authority'
    assert base!=s.snapshot_root
    before=(s.runtime_root/'database_snapshots/latest.json').read_bytes()
    with pytest.raises(ValueError,match='已发布'):publish(s,[1],1)
    assert (s.runtime_root/'database_snapshots/latest.json').read_bytes()==before
    s.authority_workbook.write_bytes(b'later-authority')
    assert workbook.read_bytes()==b'unchanged-authority'
    assert json.loads((workbook.parent.parent/result['version']/'manifest.json').read_text())['overlays'][0]['tables']['sample_master'][0]['sample_id']=='new'

def test_explorer_requires_login_and_publication_is_explicit(tmp_path: Path):
    client=make_client(tmp_path)
    assert client.get('/api/v1/explorer').status_code==401
    client.post('/api/v1/session/login',json={'username':'owner','password':'correct horse battery staple'})
    assert client.post('/api/v1/database/publish',json={'job_ids':[],'confirm':False}).status_code==422

def test_package_fingerprint_changes_after_table_edit(tmp_path: Path):
    (tmp_path/'tables').mkdir(); (tmp_path/'tables/sample_master.csv').write_text('sample_id\nA\n')
    before=package_hash(tmp_path)
    (tmp_path/'tables/sample_master.csv').write_text('sample_id\nB\n')
    assert package_hash(tmp_path)!=before

def test_schema_only_validation_cannot_publish(tmp_path: Path):
    import json
    (tmp_path/'validation_report.json').write_text(json.dumps({'valid':True,'status':'schema_only'}))
    with pytest.raises(ValueError,match='完整'):
        publication_inputs(tmp_path,'core_candidate')
