from pathlib import Path

from real_workbench.documents import (
    extract_doi_candidates,
    normalize_doi,
    sha256_file,
)


def test_hash_and_doi_normalization(tmp_path: Path) -> None:
    pdf = tmp_path / "paper.pdf"
    pdf.write_bytes(b"%PDF-1.4\nDOI: 10.1016/J.JLUMIN.2020.117544\n%%EOF")

    assert len(sha256_file(pdf)) == 64
    assert normalize_doi("https://doi.org/10.1016/J.JLUMIN.2020.117544") == (
        "10.1016/j.jlumin.2020.117544"
    )


def test_doi_candidates_are_unique_and_trimmed() -> None:
    text = (
        "doi:10.1021/jp508409r. Another reference "
        "https://doi.org/10.1021/JP508409R and 10.1111/jace.20497)"
    )

    assert extract_doi_candidates(text) == [
        "10.1021/jp508409r",
        "10.1111/jace.20497",
    ]
