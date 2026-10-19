"""Read-only model review payload. Private inputs must never enter public assets."""
from collections import defaultdict
import csv
import hashlib
import math
from pathlib import Path
from statistics import mean


def build_review(samples_path: Path, predictions_path: Path) -> dict:
    def read(path):
        return list(csv.DictReader(path.read_text(encoding='utf-8-sig').splitlines()))

    def number(value):
        if value in ('', None):
            return None
        result = float(value)
        if not math.isfinite(result):
            raise ValueError('nonfinite numeric value')
        return result

    def flag(value):
        if value not in ('True', 'False'):
            raise ValueError('invalid scoring flag')
        return value == 'True'

    def average(values):
        valid = [x for x in values if x is not None]
        return mean(valid) if valid else None

    samples = read(samples_path)
    lookup = {r['sample_id']: r for r in samples}
    if len(lookup) != len(samples):
        raise ValueError('duplicate sample IDs')
    rows = [r for r in read(predictions_path) if r['route'] == 'joint']
    if not rows or {r['sample_id'] for r in rows} != set(lookup):
        raise ValueError('prediction sample IDs do not match sample table')
    keys = {(r['seed'], r['sample_id']) for r in rows}
    if len(keys) != len(rows):
        raise ValueError('duplicate predictions')
    seeds = {r['seed'] for r in rows}
    grouped = defaultdict(list)
    for row in rows:
        grouped[row['sample_id']].append(row)
    output = []
    for sid, records in grouped.items():
        if {r['seed'] for r in records} != seeds:
            raise ValueError('incomplete partition coverage')
        for field in ('family', 'actual_nm', 'actual_excitation', 'actual_loss', 'pl_score', 'loss_score'):
            if len({r[field] for r in records}) != 1:
                raise ValueError(f'inconsistent {field} across partitions')
        first = records[0]
        pl, paired = flag(first['pl_score']), flag(first['loss_score'])
        ple = number(first['actual_excitation']) is not None
        if paired and not (pl and ple):
            raise ValueError('paired flag requires both labels')
        def error(actual, predicted, eligible, scale=1):
            if not eligible:
                return None
            values = []
            for r in records:
                a, p = number(r[actual]), number(r[predicted])
                if a is None or p is None:
                    raise ValueError('eligible target has missing value')
                values.append(abs(p-a)*scale)
            return mean(values)
        output.append(dict(sample_id=sid, family=first['family'],
            doi=lookup[sid]['doi'], composition=lookup[sid]['composition_group'],
            pl=pl, ple=ple, paired=paired,
            observed_labels=dict(pl_peak_nm=number(first['actual_nm']) if pl else None,
                excitation_ev=number(first['actual_excitation']) if ple else None,
                net_loss_ev=number(first['actual_loss']) if paired else None),
            pl_mae_nm=error('actual_nm','predicted_nm',pl),
            excitation_mae_mev=error('actual_excitation','excitation',ple,1000),
            loss_mae_mev=error('actual_loss','loss',paired,1000), decision='pending'))
    families = []
    for family in sorted({r['family'] for r in output}):
        group = [r for r in output if r['family'] == family]
        families.append(dict(family=family, records=len(group),
            compositions=len({r['composition'] for r in group}),
            sources=len({r['doi'] for r in group if r['doi']}),
            **{key:sum(r[key] for r in group) for key in ('pl','ple','paired')},
            pl_mae_nm=average([r['pl_mae_nm'] for r in group]),
            loss_mae_mev=average([r['loss_mae_mev'] for r in group])))
    return dict(development_only=True, training_influence_available=False,
        counts=dict(records=len(output), partitions=len(seeds),
            **{key:sum(r[key] for r in output) for key in ('pl','ple','paired')}),
        metrics=dict(pl_mae_nm=average([r['pl_mae_nm'] for r in output]),
            family_macro_pl_mae_nm=average([r['pl_mae_nm'] for r in families])),
        families=families,
        samples=sorted(output,key=lambda r:-(r['pl_mae_nm'] if r['pl_mae_nm'] is not None else -1)),
        provenance=dict(samples_sha256=hashlib.sha256(samples_path.read_bytes()).hexdigest(),
            predictions_sha256=hashlib.sha256(predictions_path.read_bytes()).hexdigest()))
