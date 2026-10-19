from test_api import make_client
from test_model_review import inputs
import sys


def test_training_is_authenticated_and_requires_local_configuration(tmp_path,monkeypatch):
    monkeypatch.delenv('REAL_MODEL_RESEARCH_ROOT',raising=False)
    monkeypatch.delenv('REAL_MODEL_PYTHON',raising=False)
    client=make_client(tmp_path)
    assert client.get('/api/v1/database/model-runs').status_code==401
    assert client.post('/api/v1/database/model-runs',json={'parameters':{}}).status_code==401
    client.post('/api/v1/session/login',json={'username':'owner','password':'correct horse battery staple'})
    response=client.get('/api/v1/database/model-runs')
    assert response.status_code==200
    assert response.json()['configured'] is False
    assert response.json()['parameters']['noise']['default']==.02
    assert client.post('/api/v1/database/model-runs',json={'parameters':{}}).status_code==503


def test_training_rejects_unknown_candidate_before_spawning(tmp_path,monkeypatch):
    root=tmp_path/'review';root.mkdir();s,p=inputs(root)
    (root/'local89_scope_v1').mkdir();(root/'current_observation_connection_v1').mkdir()
    s.rename(root/'local89_scope_v1/core89_samples.csv')
    p.rename(root/'current_observation_connection_v1/predictions.csv')
    repo=tmp_path/'repo';module=repo/'research/code/interactive_joint_run.py'
    module.parent.mkdir(parents=True);module.write_text('raise RuntimeError("must not run")')
    monkeypatch.setenv('REAL_MODEL_REVIEW_ROOT',str(root))
    monkeypatch.setenv('REAL_MODEL_RESEARCH_ROOT',str(repo))
    monkeypatch.setenv('REAL_MODEL_PYTHON',sys.executable)
    client=make_client(tmp_path)
    client.post('/api/v1/session/login',json={'username':'owner','password':'correct horse battery staple'})
    response=client.post('/api/v1/database/model-runs',json={'parameters':{},'candidate_decision_ids':['unknown']})
    assert response.status_code==422
    assert client.get('/api/v1/database/model-runs').json()['runs']==[]
