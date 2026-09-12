from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _path_env(name: str, default: Path) -> Path:
    return Path(os.environ.get(name, str(default))).expanduser().resolve()


@dataclass(slots=True)
class Settings:
    runtime_root: Path
    pdf_inbox_root: Path
    candidate_root: Path
    paper_vault_root: Path
    research_root: Path
    initial_admin_username: str = "sunry"
    initial_admin_password: str | None = None
    session_secret: str = ""
    max_pdf_mb: int = 100
    openai_model: str = "gpt-5.6-sol"

    @property
    def database_path(self) -> Path:
        return self.runtime_root / "real_workbench.db"

    @property
    def schema_path(self) -> Path:
        external = self.paper_vault_root / "workflows/literature_to_database/schemas/seven_table_schema.json"
        if external.exists():
            return external
        return Path(__file__).resolve().parents[1] / "resources/seven_table_schema.json"

    @property
    def public_content_root(self) -> Path:
        return Path(__file__).resolve().parents[2] / "content"

    def prepare(self) -> None:
        for path in (self.runtime_root, self.pdf_inbox_root, self.candidate_root):
            path.mkdir(parents=True, exist_ok=True)
        (self.runtime_root / "jobs").mkdir(exist_ok=True)
        if not self.session_secret:
            secret_file = self.runtime_root / "session.secret"
            if secret_file.exists():
                self.session_secret = secret_file.read_text(encoding="utf-8").strip()
            else:
                self.session_secret = os.urandom(32).hex()
                secret_file.write_text(self.session_secret, encoding="utf-8")
                secret_file.chmod(0o600)

    @classmethod
    def from_env(cls) -> "Settings":
        home = Path.home()
        research_work = home / "Documents/研究工作"
        return cls(
            runtime_root=_path_env(
                "REAL_RUNTIME_ROOT", home / "Library/Application Support/REAL/workbench"
            ),
            pdf_inbox_root=_path_env(
                "REAL_PDF_INBOX_ROOT", research_work / "01_文献/00_未处理"
            ),
            candidate_root=_path_env(
                "REAL_CANDIDATE_ROOT", research_work / "02_数据库/01_单篇提取表"
            ),
            paper_vault_root=_path_env(
                "REAL_PAPER_VAULT_ROOT", home / "Documents/real-materials-paper-vault"
            ),
            research_root=_path_env(
                "REAL_RESEARCH_ROOT", home / "Documents/real-materials-research"
            ),
            initial_admin_username=os.environ.get("REAL_INITIAL_ADMIN_USERNAME", "sunry"),
            initial_admin_password=os.environ.get("REAL_INITIAL_ADMIN_PASSWORD"),
            session_secret=os.environ.get("REAL_SESSION_SECRET", ""),
            max_pdf_mb=int(os.environ.get("REAL_MAX_PDF_MB", "100")),
            openai_model=os.environ.get("OPENAI_MODEL", "gpt-5.6-sol"),
        )
