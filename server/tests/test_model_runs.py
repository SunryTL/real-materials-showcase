import sys
import time
import pytest


def test_real_child_runs_and_returns_only_summary(tmp_path):
    from real_workbench.model_runs import ModelRuns
    repo=tmp_path/'repo'
    module=repo/'research/code/interactive_joint_run.py'
    module.parent.mkdir(parents=True)
    module.write_text("import argparse,json,pathlib\np=argparse.ArgumentParser();p.add_argument('--config');p.add_argument('--output-root');a=p.parse_args()\nr=pathlib.Path(a.output_root)/'run';r.mkdir(parents=True)\n(r/'status.json').write_text(json.dumps(dict(status='completed',completed_folds=15,total_folds=15,summary=[dict(task='emission',n=78,mae=4.5,rmse=7.5,r2=.85)])))\n")
    runs=ModelRuns(tmp_path/'runs',repo,sys.executable)
    started=runs.start({'length':1.5})
    for _ in range(100):
        result=runs.status(started['id'])
        if result['status'] in {'completed','failed'}:break
        time.sleep(.02)
    assert result['status']=='completed'
    assert result['summary'][0]['mae']==4.5
    assert str(tmp_path) not in str(result)
    assert result['parameters']['length']==1.5
    with pytest.raises(ValueError):runs.status('../outside')


@pytest.mark.parametrize('params',[{'seed':1},{'noise':0},{'length':True},{'domain_sd':float('nan')}])
def test_invalid_run_never_creates_directory(tmp_path,params):
    from real_workbench.model_runs import ModelRuns
    runs=ModelRuns(tmp_path/'runs',tmp_path,sys.executable)
    with pytest.raises(ValueError):runs.start(params)
    assert not (tmp_path/'runs').exists()


def test_candidate_is_passed_to_child_and_identified_in_run(tmp_path):
    from real_workbench.model_runs import ModelRuns
    repo=tmp_path/'repo'; module=repo/'research/code/interactive_joint_run.py'
    module.parent.mkdir(parents=True)
    module.write_text("import argparse,json,pathlib\np=argparse.ArgumentParser();p.add_argument('--config');p.add_argument('--output-root');p.add_argument('--candidate');a=p.parse_args()\nc=json.loads(pathlib.Path(a.candidate).read_text());assert c['changes'][0]['sample_id']=='a'\nr=pathlib.Path(a.output_root)/'run';r.mkdir(parents=True)\n(r/'status.json').write_text(json.dumps(dict(status='completed',completed_folds=15,summary=[])))\n")
    candidate={'status':'candidate_not_applied','changes':[{'id':'r1','sample_id':'a'}]}
    runs=ModelRuns(tmp_path/'runs',repo,sys.executable)
    started=runs.start({},candidate=candidate)
    for _ in range(100):
        result=runs.status(started['id'])
        if result['status'] in {'completed','failed'}:break
        time.sleep(.02)
    assert result['status']=='completed'
    assert result['candidate_decision_ids']==['r1']
    assert result['labels_revised'] is True


def test_reopened_manager_observes_live_child_and_blocks_duplicate(tmp_path):
    from real_workbench.model_runs import ModelRuns
    repo=tmp_path/'repo'; module=repo/'research/code/interactive_joint_run.py'
    module.parent.mkdir(parents=True)
    module.write_text('import time\ntime.sleep(30)\n')
    first=ModelRuns(tmp_path/'runs',repo,sys.executable)
    started=first.start({})
    child=first.processes[started['id']]
    try:
        second=ModelRuns(tmp_path/'runs',repo,sys.executable)
        assert second.status(started['id'])['status']=='running'
        with pytest.raises(ValueError,match='已有训练'):
            second.start({})
    finally:
        child.terminate(); child.wait(timeout=5)
    assert second.status(started['id'])['status']=='failed'


def test_completed_run_survives_manager_recreation(tmp_path):
    import json
    from real_workbench.model_runs import ModelRuns
    folder=tmp_path/('a'*32); (folder/'results/run').mkdir(parents=True)
    (folder/'request.json').write_text(json.dumps({'parameters':{}}))
    (folder/'results/run/status.json').write_text(json.dumps({
        'status':'completed','completed_folds':15,'summary':[{'mae':4.5}]}))
    assert ModelRuns(tmp_path,tmp_path,sys.executable).status('a'*32)['summary']==[{'mae':4.5}]


def test_child_remains_observable_after_launcher_process_exits(tmp_path):
    import json
    import os
    import signal
    import subprocess
    from real_workbench.model_runs import ModelRuns
    repo=tmp_path/'repo'; module=repo/'research/code/interactive_joint_run.py'
    module.parent.mkdir(parents=True)
    module.write_text('import time\ntime.sleep(30)\n')
    launched=subprocess.run([sys.executable,'-c',
        'import json,sys; from real_workbench.model_runs import ModelRuns; '
        'm=ModelRuns(sys.argv[1],sys.argv[2],sys.executable); '
        'r=m.start({}); print(json.dumps([r["id"],m.processes[r["id"]].pid]))',
        str(tmp_path/'runs'),str(repo)],capture_output=True,text=True,check=True,timeout=5)
    identifier,pid=json.loads(launched.stdout)
    reopened=ModelRuns(tmp_path/'runs',repo,sys.executable)
    try:
        assert reopened.status(identifier)['status']=='running'
        with pytest.raises(ValueError,match='已有训练'):
            reopened.start({})
    finally:
        os.kill(pid,signal.SIGTERM)
    for _ in range(100):
        if reopened.status(identifier)['status']=='failed':break
        time.sleep(.02)
    assert reopened.status(identifier)['status']=='failed'
