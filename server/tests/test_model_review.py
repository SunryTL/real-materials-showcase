import csv
import json

import pytest

from real_workbench.model_review import build_review


def inputs(tmp_path):
    samples = [{'sample_id': 'a', 'doi': 'doi-a', 'composition_group': 'x'},
               {'sample_id': 'b', 'doi': 'doi-b', 'composition_group': 'y'}]
    predictions = []
    for seed in (1, 2, 3):
        for sid, family, error in [('a', 'Y / Al', 2), ('b', 'Lu / Al', 8)]:
            predictions.append(dict(route='joint', seed=seed, sample_id=sid,
                family=family, actual_nm=550, predicted_nm=550+error,
                actual_excitation='', actual_loss='', excitation=2.8, loss=.5,
                pl_score='True', loss_score='False'))
    for name, rows in [('samples', samples), ('predictions', predictions)]:
        with (tmp_path/f'{name}.csv').open('w', newline='') as f:
            writer=csv.DictWriter(f, fieldnames=rows[0]);writer.writeheader();writer.writerows(rows)
    return tmp_path/'samples.csv', tmp_path/'predictions.csv'


def test_review_counts_records_not_repeated_predictions(tmp_path):
    s,p=inputs(tmp_path)
    result=build_review(s,p)
    assert result['counts']==dict(records=2, pl=2, ple=0, paired=0, partitions=3)
    assert result['metrics']['pl_mae_nm']==5
    assert result['samples'][0]['sample_id']=='b'
    assert result['samples'][0]['decision']=='pending'
    assert result['samples'][0]['loss_mae_mev'] is None
    assert len(result['provenance']['samples_sha256'])==64
    json.dumps(result,allow_nan=False)


def test_duplicate_prediction_rejected(tmp_path):
    s,p=inputs(tmp_path)
    with p.open('a') as f:f.write(p.read_text().splitlines()[1]+'\n')
    with pytest.raises(ValueError,match='duplicate'):build_review(s,p)


def test_review_exposes_observed_label_not_prediction(tmp_path):
    s,p=inputs(tmp_path)
    result=build_review(s,p)
    assert result['samples'][0]['observed_labels']=={
        'pl_peak_nm':550.0, 'excitation_ev':None, 'net_loss_ev':None}


def test_review_masks_ineligible_pl_label(tmp_path):
    s,p=inputs(tmp_path)
    p.write_text(p.read_text().replace('True,False','False,False'))
    result=build_review(s,p)
    assert all(r['observed_labels']['pl_peak_nm'] is None for r in result['samples'])


def test_unknown_sample_rejected(tmp_path):
    s,p=inputs(tmp_path)
    p.write_text(p.read_text().replace(',a,',',unknown,'))
    with pytest.raises(ValueError,match='sample IDs'):build_review(s,p)


def test_incomplete_partition_rejected(tmp_path):
    s,p=inputs(tmp_path)
    p.write_text('\n'.join(p.read_text().splitlines()[:-1])+'\n')
    with pytest.raises(ValueError,match='partition'):build_review(s,p)
