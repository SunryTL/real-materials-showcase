import csv
import hashlib
import json
import pytest


def fixture(tmp_path):
    review=dict(provenance={'samples_sha256':'a','predictions_sha256':'b'},
        counts=dict(records=2,partitions=3,pl=2,ple=2,paired=2),
        samples=[dict(sample_id=s,pl=True,ple=True,paired=True) for s in ['a','b']])
    rows=[]
    for sid in ['a','b']:
        for task in ['emission','excitation','loss']:
            rows.append(dict(omitted_id=sid,task=task,n=1,baseline_mae=5,removed_mae=4,
                delta_mae=-1,delta_min=-2,delta_max=0,improved_partitions=2,
                family_macro_delta=-1,refitted_folds=12))
    with (tmp_path/'summary.csv').open('w') as f:
        w=csv.DictWriter(f,fieldnames=rows[0]);w.writeheader();w.writerows(rows)
    (tmp_path/'contract.json').write_text(json.dumps(dict(provenance=review['provenance'],
        development_only=True,automatic_deletion=False)))
    (tmp_path/'status.json').write_text(json.dumps(dict(status='completed')))
    seal(tmp_path)
    return review


def seal(root):
    (root/'manifest.json').write_text(json.dumps(dict(outputs={
        name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in ['summary.csv','contract.json']})))


def test_verified_influence_attaches_without_marking_samples_for_deletion(tmp_path):
    from real_workbench.training_influence import attach_influence
    review=fixture(tmp_path);attach_influence(review,tmp_path)
    assert review['training_influence_available'] is True
    assert review['samples'][0]['training_influence']['emission']['delta_mae']==-1
    assert 'decision' not in review['samples'][0]


@pytest.mark.parametrize('damage',['hash','version','scope','metric'])
def test_stale_or_changed_influence_is_rejected(tmp_path,damage):
    from real_workbench.training_influence import attach_influence
    review=fixture(tmp_path)
    if damage=='version':review['provenance']['samples_sha256']='new'
    else:
        text=(tmp_path/'summary.csv').read_text()
        if damage=='hash':text+='\n'
        if damage=='scope':text=text.replace('a,emission','unknown,emission')
        if damage=='metric':text=text.replace(',5,4,-1,',',5,4,9,')
        (tmp_path/'summary.csv').write_text(text)
        if damage!='hash':seal(tmp_path)
    with pytest.raises(ValueError):attach_influence(review,tmp_path)


def test_absent_analysis_does_not_block_review(tmp_path):
    from real_workbench.training_influence import attach_influence
    review={};attach_influence(review,tmp_path/'missing')
    assert review['training_influence_available'] is False
