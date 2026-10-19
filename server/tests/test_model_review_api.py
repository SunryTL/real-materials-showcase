from test_api import make_client
from test_model_review import inputs


def test_model_review_requires_login_and_explicit_local_files(tmp_path, monkeypatch):
    monkeypatch.delenv('REAL_MODEL_REVIEW_ROOT', raising=False)
    client=make_client(tmp_path)
    assert client.get('/api/v1/database/model-review').status_code==401
    client.post('/api/v1/session/login',json={'username':'owner','password':'correct horse battery staple'})
    assert client.get('/api/v1/database/model-review').status_code==503


def test_model_review_returns_private_payload_without_absolute_paths(tmp_path, monkeypatch):
    root=tmp_path/'review';root.mkdir()
    s,p=inputs(root)
    (root/'local89_scope_v1').mkdir()
    (root/'current_observation_connection_v1').mkdir()
    s.rename(root/'local89_scope_v1/core89_samples.csv')
    p.rename(root/'current_observation_connection_v1/predictions.csv')
    monkeypatch.setenv('REAL_MODEL_REVIEW_ROOT',str(root))
    client=make_client(tmp_path)
    client.post('/api/v1/session/login',json={'username':'owner','password':'correct horse battery staple'})
    response=client.get('/api/v1/database/model-review')
    assert response.status_code==200
    assert response.json()['counts']['records']==2
    assert str(tmp_path) not in response.text
    payload={'sample_id':'a','decision':'keep','reason':'已核对原文','provenance':response.json()['provenance']}
    assert client.post('/api/v1/database/model-review/decisions',json={**payload,'provenance':{}}).status_code==409
    saved=client.post('/api/v1/database/model-review/decisions',json=payload)
    assert saved.status_code==200
    assert saved.json()['authority_database_changed'] is False
    history=client.get('/api/v1/database/model-review').json()['decisions']
    assert len(history)==1
    assert history[0]['sample_id']=='a'
    correction={'field':'pl_peak_nm','old_value':550,'new_value':552,'unit':'nm','evidence':'图3b'}
    saved=client.post('/api/v1/database/model-review/decisions',json={**payload,'decision':'propose_correction','correction':correction})
    assert saved.status_code==200
    assert saved.json()['record']['correction']==correction
    source_paths=[root/'local89_scope_v1/core89_samples.csv',root/'current_observation_connection_v1/predictions.csv']
    before=[path.read_bytes() for path in source_paths]
    missing_old={'field':'ple_peak_nm','new_value':460,'unit':'nm','evidence':'图4，PLE长波激发带'}
    saved=client.post('/api/v1/database/model-review/decisions',json={**payload,'decision':'propose_correction','correction':missing_old})
    assert saved.status_code==200
    assert saved.json()['record']['correction']['old_value'] is None
    invalid=client.post('/api/v1/database/model-review/decisions',json={**payload,'decision':'propose_correction','correction':{**missing_old,'new_value':0}})
    assert invalid.status_code==422
    assert len(client.get('/api/v1/database/model-review').json()['decisions'])==3
    assert [path.read_bytes() for path in source_paths]==before
    identifier=saved.json()['record']['id']
    exported=client.post('/api/v1/database/model-review/candidate',json={'decision_ids':[identifier]})
    assert exported.status_code==200
    assert exported.json()['status']=='candidate_not_applied'
    assert exported.json()['changes'][0]['correction']['new_value']==460
    assert [path.read_bytes() for path in source_paths]==before
