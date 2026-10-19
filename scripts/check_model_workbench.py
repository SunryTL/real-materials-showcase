"""Exercise real local model APIs in an isolated runtime, never the user's reviews.

Requires REAL_MODEL_RESEARCH_ROOT, REAL_MODEL_REVIEW_ROOT and REAL_MODEL_PYTHON.
Run with PYTHONPATH=server and the backend Python; --train also replays defaults.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import secrets
import tempfile
import time

from fastapi.testclient import TestClient
from real_workbench.app import create_app
from real_workbench.config import Settings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--train', action='store_true')
    args = parser.parse_args()
    for name in ('REAL_MODEL_RESEARCH_ROOT', 'REAL_MODEL_REVIEW_ROOT', 'REAL_MODEL_PYTHON'):
        if not os.environ.get(name):
            parser.error(f'Missing {name}')
    archive = Path(os.environ.get('REAL_RUNTIME_ROOT',
                   str(Path.home()/'Library/Application Support/REAL/workbench')))/'verification'
    archive.mkdir(parents=True, exist_ok=True)
    root = Path(tempfile.mkdtemp(prefix='real-model-smoke-', dir=archive))
    review = Path(os.environ['REAL_MODEL_REVIEW_ROOT'])
    files = [review/'local89_scope_v1/core89_samples.csv',
             review/'current_observation_connection_v1/predictions.csv']
    def hashes():
        return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    before = hashes()
    password = secrets.token_urlsafe(32)
    settings = Settings(runtime_root=root/'runtime', pdf_inbox_root=root/'inbox',
                        candidate_root=root/'candidates', paper_vault_root=root/'vault',
                        research_root=Path(os.environ['REAL_MODEL_RESEARCH_ROOT']),
                        initial_admin_username='smoke', initial_admin_password=password)
    report = {'runtime': str(root), 'source_hashes': before}
    with TestClient(create_app(settings)) as client:
        assert client.get('/api/v1/database/model-review').status_code == 401
        assert client.post('/api/v1/session/login', json={
            'username': 'smoke', 'password': password}).status_code == 200
        response = client.get('/api/v1/database/model-review')
        assert response.status_code == 200, response.text
        data = response.json()
        assert data['counts'] == dict(records=89, partitions=3, pl=78, ple=30, paired=23)
        assert data['training_influence_available']
        saved = client.post('/api/v1/database/model-review/decisions', json=dict(
            sample_id=data['samples'][0]['sample_id'], decision='keep',
            reason='隔离接口测试，不构成科研审核决定', provenance=data['provenance']))
        assert saved.status_code == 200, saved.text
        assert saved.json()['authority_database_changed'] is False
        assert len(client.get('/api/v1/database/model-review').json()['decisions']) == 1
        runs = client.get('/api/v1/database/model-runs').json()
        assert runs['configured'] and len(runs['parameters']) == 5
        report.update(counts=data['counts'], metrics=data['metrics'],
                      families=data['families'], training_influence=True,
                      isolated_review_saved=True, parameters=list(runs['parameters']))
        if args.train:
            response = client.post('/api/v1/database/model-runs', json={'parameters': {}})
            assert response.status_code == 200, response.text
            run = response.json()
            print(json.dumps({'runtime': str(root), 'started': run}, ensure_ascii=False), flush=True)
            while run['status'] == 'running':
                time.sleep(2)
                response = client.get('/api/v1/database/model-runs/'+run['id'])
                assert response.status_code == 200, response.text
                run = response.json()
            report['training'] = run
            assert run['status'] == 'completed', run
            assert run['completed_folds'] == 15
            expected = {'emission': (78, 4.554093307706703, .8554937960375026),
                        'excitation': (30, 15.409617077259568, .728224694531494),
                        'loss': (23, 30.422902043426177, .4354676055064332)}
            assert {r['task'] for r in run['summary']} == set(expected)
            for row in run['summary']:
                n, mae, r2 = expected[row['task']]
                assert row['n'] == n
                assert math.isclose(row['mae'], mae, abs_tol=1e-7)
                assert math.isclose(row['r2'], r2, abs_tol=1e-7)
            report['frozen_default_metrics_reproduced'] = True
    assert hashes() == before, 'Source data changed'
    report['source_hashes_unchanged'] = True
    (root/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
