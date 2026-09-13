"""Opt-in cross-repository integration using disposable synthetic test evidence.

REAL_ATLAS_TEST_ROOT points to the research checkout. No production candidate,
Excel, or paid model call is touched. The validator is isolated in its own tests.
"""
import os
import sys
from pathlib import Path
import pytest

def test_real_statistics_after_immutable_publication(tmp_path, monkeypatch):
    research=os.environ.get('REAL_ATLAS_TEST_ROOT')
    python=os.environ.get('REAL_PUBFIG_PYTHON')
    if not research or not python: pytest.skip('Set research root and scientific Python for cross-repo test')
    sys.path.insert(0,research)
    from research.tests.test_database_atlas import DatabaseAtlasTests
    from real_workbench.config import Settings
    from real_workbench.database import init_database,connect
    from real_workbench.explorer import calculate,publish
    fixture=tmp_path/'fixture';fixture.mkdir()
    source,workbook=DatabaseAtlasTests()._write_bundle(fixture)
    s=Settings(runtime_root=tmp_path/'run',pdf_inbox_root=tmp_path/'in',candidate_root=tmp_path/'candidates',paper_vault_root=tmp_path/'vault',research_root=Path(research),authority_workbook=workbook,pubfig_python=Path(python))
    monkeypatch.setattr(Settings,'snapshot_root',property(lambda self:source))
    s.prepare();init_database(s.database_path)
    with connect(s.database_path) as db:
        db.execute("INSERT INTO users VALUES(1,'test','test','hash','owner',1,'now')")
        db.execute("INSERT INTO documents(id,sha256,size_bytes,canonical_filename,created_by,created_at,updated_at) VALUES(1,'sha',1,'fixture.pdf',1,'now','now')")
        db.execute("INSERT INTO jobs(id,document_id,status,stage,package_path,created_by,created_at,updated_at) VALUES(1,1,'candidate_ready','ready','fixture',1,'now','now')")
        db.execute("INSERT INTO package_reviews(job_id,reviewer_id,decision,created_at,reviewed_package_sha256) VALUES(1,1,'core_candidate','now','fixture-hash')")
    package={'status':'formal','decision':'core_candidate','package_sha256':'fixture-hash','tables':{
        'sample_master':[{'sample_id':'NEW','host_family':'YAG','material_form':'ceramic','normalized_formula':'YAG-1'}],
        'optical_measurement':[{'sample_id':'NEW','room_temperature_flag':True,'emission_peak_nm':545}],
        'data_source':[{'sample_id':'NEW','doi':'10/new'}]}}
    monkeypatch.setattr('real_workbench.explorer.publication_inputs',lambda *_:package)
    before=calculate(s); authority=workbook.read_bytes()
    published=publish(s,[1],1);after=calculate(s)
    assert after['version']==published['version']
    assert after['summary']['samples']==before['summary']['samples']+1
    assert len(after['points'])==len(before['points'])+1
    assert len(after['charts']['relationship']['points'])==len(before['charts']['relationship']['points'])+1
    assert after['source_hash']!=before['source_hash']
    assert workbook.read_bytes()==authority
    assert calculate(s,version='baseline')['summary']==before['summary']
