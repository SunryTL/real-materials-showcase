# REAL research update — 2026-10-29

The existing 255-record public release and evidence-galaxy-v1 renderer are unchanged. The reviewed 92-record training subset is a separate selectable release, not a replacement for the full literature library.

- `paper-architecture.png`: embedded original image from the user-provided 中文论文_逐段主稿.docx. Figure insets show earlier examples; current reviewed92 performance is reported separately. Dashed experimental validation remains proposed.
- `physical-quantities.png`: user-authored four-panel research-basis composite, original pixels preserved. Public-data methodological reconstruction, not the reviewed92 ceramic model.
- Existing 08_emission_landscape.png and 07_evidence_topology.png: historical core-data views, retained with explicit scope captions.
- Latest metrics: reviewed92_hierarchy_algorithms_20261029_v1. 3 repeated 5-fold composition-grouped outer CV, inner selection. Every route's MAE, RMSE and R² recomputed from per-repeat OOF predictions and checked against summary.csv before export.
- Public data: selected sample ID, DOI, formula, family, emission, coverage and derived PCA coordinates. No private workbook, PDF, raw feature vector, fitted estimator, or local path is included.
- PCA: nine composition/site/radius descriptors, standardized on this exploratory dataset; this visualization is separate from prediction training. No missing descriptor imputation.
- Rebuild with `scripts/export-reviewed-research.py SOURCE_EXPERIMENT_DIRECTORY` using numpy/pandas/scipy/sklearn. Source hashes are stored in the result JSON and release manifest.
