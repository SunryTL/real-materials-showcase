import pytest
from real_workbench.review_decisions import save_decision, read_decisions


def test_correction_preserves_values_and_evidence(tmp_path):
    change={'field':'pl_peak_nm','old_value':550,'new_value':552,'unit':'nm','evidence':'原文图3b，室温PL峰'}
    record=save_decision(tmp_path,'a','propose_correction','重新读图',{},1,{'a'},correction=change)
    assert read_decisions(tmp_path)[0]['correction']==change
    assert record['status']=='review_only'


def test_omitted_old_value_is_saved_as_missing(tmp_path):
    change={'field':'pl_peak_nm','new_value':552,'unit':'nm','evidence':'原文图3b'}
    record=save_decision(tmp_path,'a','propose_correction','补录缺失峰位',{},1,{'a'},correction=change)
    assert record['correction']['old_value'] is None
    assert read_decisions(tmp_path)[0]['correction']['new_value']==552
    assert 'old_value' not in change


@pytest.mark.parametrize('change',[
    {'field':'pl_peak_nm','old_value':550,'new_value':float('nan'),'unit':'nm','evidence':'图3'},
    {'field':'pl_peak_nm','old_value':550,'new_value':552,'unit':'eV','evidence':'图3'},
    {'field':'pl_peak_nm','old_value':550,'new_value':552,'unit':'nm','evidence':''},
])
def test_invalid_correction_leaves_history_unchanged(tmp_path,change):
    with pytest.raises(ValueError):
        save_decision(tmp_path,'a','propose_correction','修改',{},1,{'a'},correction=change)
    assert read_decisions(tmp_path)==[]


def test_decisions_are_append_only_and_bound_to_source(tmp_path):
    a=save_decision(tmp_path,'a','keep','原文核对一致',{'samples_sha256':'x','predictions_sha256':'y'},1,{'a'})
    b=save_decision(tmp_path,'a','check','需要重新确认峰位',{'samples_sha256':'x','predictions_sha256':'y'},1,{'a'})
    rows=read_decisions(tmp_path)
    assert len(rows)==2
    assert a['id']!=b['id']
    assert rows[0]['decision']=='keep'
    assert rows[1]['provenance']['samples_sha256']=='x'


@pytest.mark.parametrize('sample,decision,reason',[('unknown','keep','确认'),('a','delete','确认'),('a','keep',' ')])
def test_invalid_decision_does_not_write(tmp_path,sample,decision,reason):
    with pytest.raises(ValueError):save_decision(tmp_path,sample,decision,reason,{'samples_sha256':'x','predictions_sha256':'y'},1,{'a'})
    assert read_decisions(tmp_path)==[]


def test_candidate_export_preserves_selected_evidence_and_history(tmp_path):
    from real_workbench import review_decisions
    record=save_decision(tmp_path,'a','propose_correction','核对',{'samples_sha256':'x'},1,{'a'},
        correction={'field':'pl_peak_nm','old_value':550,'new_value':552,'unit':'nm','evidence':'图3'})
    before=read_decisions(tmp_path)
    package=review_decisions.candidate_package(tmp_path,[record['id']],{'samples_sha256':'x'})
    assert package['changes'][0]['correction']['new_value']==552
    assert package['changes'][0]['id']==record['id']
    assert package['status']=='candidate_not_applied'
    assert read_decisions(tmp_path)==before
    with pytest.raises(ValueError,match='版本'):
        review_decisions.candidate_package(tmp_path,[record['id']],{'samples_sha256':'changed'})


def test_candidate_export_rejects_conflicting_field_proposals(tmp_path):
    from real_workbench import review_decisions
    ids=[]
    for n in (552,553):
        ids.append(save_decision(tmp_path,'a','propose_correction','核对',{},1,{'a'},
            correction={'field':'pl_peak_nm','old_value':550,'new_value':n,'unit':'nm','evidence':'图3'})['id'])
    with pytest.raises(ValueError,match='同一字段'):
        review_decisions.candidate_package(tmp_path,ids,{})
