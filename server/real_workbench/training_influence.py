"""Private, hash-bound deletion diagnostics for human review only."""
import csv
import hashlib
import json
import math
from pathlib import Path


def attach_influence(review, root):
    root=Path(root)
    review['training_influence_available']=False
    if not root.exists():return
    status=json.loads((root/'status.json').read_text())
    if status.get('status')!='completed':return
    manifest=json.loads((root/'manifest.json').read_text())
    for name in ['summary.csv','contract.json']:
        if hashlib.sha256((root/name).read_bytes()).hexdigest()!=manifest['outputs'].get(name):
            raise ValueError('Influence artifact hash mismatch')
    contract=json.loads((root/'contract.json').read_text())
    if contract.get('provenance')!=review['provenance']:
        raise ValueError('Influence data version mismatch')
    if contract.get('development_only') is not True or contract.get('automatic_deletion') is not False:
        raise ValueError('Influence interpretation contract mismatch')
    samples={r['sample_id']:r for r in review['samples']}
    tasks={'emission':'pl','excitation':'ple','loss':'paired'}
    groups={sid:{} for sid in samples}
    with (root/'summary.csv').open(newline='') as f:
        for row in csv.DictReader(f):
            sid,task=row['omitted_id'],row['task']
            if sid not in groups or task not in tasks or task in groups[sid]:
                raise ValueError('Influence scope mismatch')
            values={key:float(row[key]) for key in ['baseline_mae','removed_mae','delta_mae',
                'delta_min','delta_max','family_macro_delta']}
            if not all(math.isfinite(v) for v in values.values()):raise ValueError('Invalid influence value')
            if not math.isclose(values['removed_mae']-values['baseline_mae'],values['delta_mae'],abs_tol=1e-8):
                raise ValueError('Inconsistent influence metric')
            n=int(row['n']);expected=review['counts'][tasks[task]]-int(samples[sid][tasks[task]])
            improved=int(row['improved_partitions']);refits=int(row['refitted_folds'])
            if n!=expected or not 0<=improved<=review['counts']['partitions'] or not 0<=refits<=15:
                raise ValueError('Influence evaluation counts mismatch')
            groups[sid][task]={**values,'n':n,'improved_partitions':improved,'refitted_folds':refits}
    if any(set(values)!=set(tasks) for values in groups.values()):
        raise ValueError('Incomplete influence coverage')
    for sid,row in samples.items():row['training_influence']=groups[sid]
    review['training_influence_available']=True
    review['training_influence_note']='逐一暂时移除训练记录并重新拟合；负数表示其他测试样品误差下降。当前为开发诊断，不自动删除记录。'
