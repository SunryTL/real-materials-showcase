from __future__ import annotations

import json
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from .config import Settings
from .database import connect, init_database
from .documents import (
    doi_candidates_from_bytes,
    extract_doi_candidates,
    extract_pdf_text,
    normalize_doi,
    safe_filename,
    sha256_file,
    validate_pdf_bytes,
)
from .extraction import OpenAIExtractionProvider, PROMPT_VERSION
from .packages import (
    FIELD_EVIDENCE_COLUMNS,
    GROUPING_COLUMNS,
    SEVEN_TABLE_NAMES,
    export_xlsx,
    import_candidate_bundle,
    read_package,
    write_candidate_package,
)
from .research_data import PRIORITY_DOIS, WEEKLY_EVIDENCE, database_health
from .figures import database_release_version, latest_release, manifest_for, render_release, resolve_asset
from .explorer import calculate as explorer_statistics, versions as database_versions, publish as publish_database, package_hash
from .security import hash_password, new_session, session_hash, utc_now, verify_password


class LoginInput(BaseModel):
    username: str
    password: str


class DocumentPatch(BaseModel):
    doi_confirmed: str
    target_family: str = ""
    target_fields: list[str] = Field(default_factory=list)


class ExtractionInput(BaseModel):
    confirm_send_to_openai: bool


class TablePatch(BaseModel):
    rows: list[dict[str, Any]]


class ReviewInput(BaseModel):
    decision: str
    notes: str = ""

class PublishInput(BaseModel):
    job_ids: list[int]
    confirm: bool = False


def _row_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _document_payload(row: sqlite3.Row) -> dict[str, Any]:
    payload = dict(row)
    payload["doi_candidates"] = json.loads(payload.pop("doi_candidates_json"))
    payload["target_fields"] = json.loads(payload.pop("target_fields_json"))
    payload["sha256_short"] = payload["sha256"][:12]
    return payload


def _audit(connection: sqlite3.Connection, actor: int | None, action: str, entity: str, entity_id: int | None, before: Any = None, after: Any = None) -> None:
    connection.execute(
        "INSERT INTO audit_events(actor_id,action,entity_type,entity_id,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?)",
        (actor, action, entity, entity_id, _json(before) if before is not None else None, _json(after) if after is not None else None, utc_now()),
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    settings.prepare()
    init_database(settings.database_path)
    with connect(settings.database_path) as connection:
        count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count == 0 and settings.initial_admin_password:
            connection.execute(
                "INSERT INTO users(username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?)",
                (settings.initial_admin_username, "负责人", hash_password(settings.initial_admin_password), "owner", utc_now()),
            )

    app = FastAPI(title="REAL Research Workbench API", version="0.1.0")
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def current_user(request: Request) -> dict[str, Any]:
        token = request.cookies.get("real_session")
        if not token:
            raise HTTPException(401, "请先登录REAL私有工作台")
        with connect(settings.database_path) as connection:
            row = connection.execute(
                "SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>? AND users.active=1",
                (session_hash(token), utc_now()),
            ).fetchone()
        if not row:
            raise HTTPException(401, "会话已失效，请重新登录")
        return dict(row)

    @app.get("/api/v1/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "mode": "private-local-workbench",
            "openai_configured": bool(__import__("os").environ.get("OPENAI_API_KEY")),
            "authority_write_enabled": False,
        }

    @app.post("/api/v1/session/login")
    def login(payload: LoginInput, response: Response) -> dict[str, Any]:
        with connect(settings.database_path) as connection:
            row = connection.execute("SELECT * FROM users WHERE username=? AND active=1", (payload.username,)).fetchone()
            if not row or not verify_password(payload.password, row["password_hash"]):
                raise HTTPException(401, "账号或密码不正确")
            token, token_hash, expires = new_session()
            connection.execute(
                "INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)",
                (token_hash, row["id"], utc_now(), expires),
            )
        response.set_cookie("real_session", token, httponly=True, samesite="lax", secure=False, max_age=7 * 86400)
        return {"id": row["id"], "username": row["username"], "display_name": row["display_name"], "role": row["role"]}

    @app.post("/api/v1/session/logout")
    def logout(request: Request, response: Response) -> dict[str, bool]:
        token = request.cookies.get("real_session")
        if token:
            with connect(settings.database_path) as connection:
                connection.execute("DELETE FROM sessions WHERE token_hash=?", (session_hash(token),))
        response.delete_cookie("real_session")
        return {"ok": True}

    @app.get("/api/v1/session/me")
    def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        return {key: user[key] for key in ("id", "username", "display_name", "role")}

    def register_pdf(data: bytes, filename: str, source_type: str, user_id: int, managed_name: str | None = None) -> dict[str, Any]:
        validate_pdf_bytes(data, settings.max_pdf_mb * 1024 * 1024)
        filename = safe_filename(filename)
        digest = __import__("hashlib").sha256(data).hexdigest()
        candidates = doi_candidates_from_bytes(data)
        now = utc_now()
        with connect(settings.database_path) as connection:
            existing = connection.execute("SELECT * FROM documents WHERE sha256=?", (digest,)).fetchone()
            duplicate = existing is not None
            if existing:
                document_id = existing["id"]
                relative_path = managed_name or existing["canonical_filename"]
            else:
                destination_name = managed_name or filename
                destination = settings.pdf_inbox_root / destination_name
                if destination.exists() and sha256_file(destination) != digest:
                    destination = destination.with_name(f"{destination.stem}_{digest[:8]}.pdf")
                if not destination.exists():
                    destination.write_bytes(data)
                relative_path = destination.name
                cursor = connection.execute(
                    "INSERT INTO documents(sha256,size_bytes,canonical_filename,doi_candidates_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                    (digest, len(data), destination.name, _json(candidates), user_id, now, now),
                )
                document_id = cursor.lastrowid
            connection.execute(
                "INSERT OR IGNORE INTO document_locations(document_id,original_filename,source_type,managed_relative_path,observed_by,observed_at) VALUES(?,?,?,?,?,?)",
                (document_id, filename, source_type, relative_path, user_id, now),
            )
            _audit(connection, user_id, "register_pdf", "document", document_id, after={"filename": filename, "duplicate": duplicate, "sha256": digest})
            location_count = connection.execute("SELECT COUNT(*) FROM document_locations WHERE document_id=?", (document_id,)).fetchone()[0]
        return {"document_id": document_id, "filename": filename, "sha256": digest, "sha256_short": digest[:12], "doi_candidates": candidates, "duplicate": duplicate, "location_count": location_count}

    @app.post("/api/v1/documents")
    async def upload_documents(files: list[UploadFile] = File(...), user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        items = []
        for upload in files:
            data = await upload.read()
            items.append(register_pdf(data, upload.filename or "paper.pdf", "uploaded", user["id"]))
        return {"items": items}

    @app.post("/api/v1/documents/scan")
    def scan_documents(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        items = []
        for path in sorted(settings.pdf_inbox_root.glob("*.pdf")):
            items.append(register_pdf(path.read_bytes(), path.name, "scanned_local", user["id"], path.name))
        return {"items": items, "scanned": len(items)}

    @app.post("/api/v1/candidate-imports")
    async def import_candidate_tables(
        file: UploadFile = File(...), document_id: int | None = Form(None), user: dict[str, Any] = Depends(current_user)
    ) -> dict[str, Any]:
        data = await file.read()
        if len(data) > settings.max_pdf_mb * 1024 * 1024:
            raise HTTPException(413, "候选表格文件过大")
        try:
            result = import_candidate_bundle(
                output_root=settings.candidate_root,
                schema_path=settings.schema_path,
                filename=file.filename or "candidate.xlsx",
                data=data,
            )
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        with connect(settings.database_path) as connection:
            job_id = None
            if document_id is not None:
                document = connection.execute("SELECT id FROM documents WHERE id=?", (document_id,)).fetchone()
                if not document:
                    raise HTTPException(404, "关联论文不存在")
                now = utc_now()
                cursor = connection.execute(
                    "INSERT INTO jobs(document_id,status,stage,progress,message,model,prompt_version,package_path,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                    (document_id, "candidate_ready", "human_review", 100, "Codex七表候选已导入，等待人工审核", "codex_handoff", "database-workflow-v2", result["package_path"], user["id"], now, now),
                )
                job_id = cursor.lastrowid
                connection.execute("UPDATE documents SET workflow_status='candidate_ready',updated_at=? WHERE id=?", (now, document_id))
            _audit(
                connection,
                user["id"],
                "import_candidate_tables",
                "candidate_import",
                None,
                after={"sha256": result["sha256"], "filename": result["filename"]},
            )
        return {
            **result,
            "sample_rows": result["row_counts"].get("sample_master", 0),
            "authority_write_enabled": False,
            "job_id": job_id,
        }

    @app.get("/api/v1/documents")
    def list_documents(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        with connect(settings.database_path) as connection:
            rows = connection.execute(
                "SELECT documents.*, users.display_name AS owner_name, COUNT(document_locations.id) AS location_count FROM documents JOIN users ON users.id=documents.created_by LEFT JOIN document_locations ON document_locations.document_id=documents.id GROUP BY documents.id ORDER BY documents.updated_at DESC"
            ).fetchall()
        return {"items": [{**_document_payload(row), "duplicate": row["location_count"] > 1} for row in rows]}

    @app.get("/api/v1/documents/{document_id}")
    def get_document(document_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        with connect(settings.database_path) as connection:
            row = connection.execute("SELECT * FROM documents WHERE id=?", (document_id,)).fetchone()
            if not row:
                raise HTTPException(404, "文献不存在")
            locations = [dict(item) for item in connection.execute("SELECT id,original_filename,source_type,managed_relative_path,observed_at FROM document_locations WHERE document_id=?", (document_id,)).fetchall()]
        return {**_document_payload(row), "locations": locations}

    @app.patch("/api/v1/documents/{document_id}")
    def patch_document(document_id: int, payload: DocumentPatch, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        try:
            doi = normalize_doi(payload.doi_confirmed)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        with connect(settings.database_path) as connection:
            before = connection.execute("SELECT * FROM documents WHERE id=?", (document_id,)).fetchone()
            if not before:
                raise HTTPException(404, "文献不存在")
            connection.execute(
                "UPDATE documents SET doi_confirmed=?,doi_confirmation_status='confirmed',target_family=?,target_fields_json=?,workflow_status='ready_for_extraction',updated_at=? WHERE id=?",
                (doi, payload.target_family.strip(), _json(payload.target_fields), utc_now(), document_id),
            )
            after = connection.execute("SELECT * FROM documents WHERE id=?", (document_id,)).fetchone()
            _audit(connection, user["id"], "confirm_metadata", "document", document_id, before=dict(before), after=dict(after))
        return _document_payload(after)

    @app.get("/api/v1/dashboard")
    def dashboard(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        with connect(settings.database_path) as connection:
            unique_pdf = connection.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
            locations = connection.execute("SELECT COUNT(*) FROM document_locations").fetchone()[0]
            duplicate_groups = connection.execute("SELECT COUNT(*) FROM (SELECT document_id FROM document_locations GROUP BY document_id HAVING COUNT(*)>1)").fetchone()[0]
            ready = connection.execute("SELECT COUNT(*) FROM documents WHERE workflow_status='ready_for_extraction'").fetchone()[0]
            candidate_ready = connection.execute("SELECT COUNT(*) FROM jobs WHERE status='candidate_ready'").fetchone()[0]
            recent = [dict(row) for row in connection.execute("SELECT jobs.id,documents.canonical_filename,jobs.status,jobs.stage,jobs.progress,jobs.message,jobs.updated_at FROM jobs JOIN documents ON documents.id=jobs.document_id ORDER BY jobs.updated_at DESC LIMIT 6").fetchall()]
        health_data = database_health(settings.public_content_root, settings.candidate_root)
        return {"documents": {"unique_pdf": unique_pdf, "locations": locations, "duplicate_groups": duplicate_groups, "ready_for_extraction": ready, "candidate_ready": candidate_ready}, "database": health_data, "jobs": recent, "weekly": WEEKLY_EVIDENCE}

    def run_extraction_job(job_id: int, document_id: int) -> None:
        try:
            with connect(settings.database_path) as connection:
                document = connection.execute("SELECT * FROM documents WHERE id=?", (document_id,)).fetchone()
                location = connection.execute("SELECT managed_relative_path FROM document_locations WHERE document_id=? ORDER BY id LIMIT 1", (document_id,)).fetchone()
                connection.execute("UPDATE jobs SET status='running',stage='reading_pdf',progress=10,message='正在读取论文与核对元数据',updated_at=? WHERE id=?", (utc_now(), job_id))
            pdf_path = (settings.pdf_inbox_root / location["managed_relative_path"]).resolve()
            if settings.pdf_inbox_root.resolve() not in pdf_path.parents:
                raise RuntimeError("PDF路径越界")
            schema = json.loads(settings.schema_path.read_text(encoding="utf-8"))
            with connect(settings.database_path) as connection:
                connection.execute("UPDATE jobs SET stage='ai_extraction',progress=30,message='已确认发送，OpenAI正在生成七表候选数据',updated_at=? WHERE id=?", (utc_now(), job_id))
            provider = OpenAIExtractionProvider(settings.openai_model)
            payload, usage = provider.extract(
                pdf_path=pdf_path,
                doi=document["doi_confirmed"],
                target_family=document["target_family"] or "",
                target_fields=json.loads(document["target_fields_json"]),
                schema=schema,
            )
            package = write_candidate_package(
                output_root=settings.candidate_root,
                schema_path=settings.schema_path,
                doi=document["doi_confirmed"],
                pdf_sha256=document["sha256"],
                target_family=document["target_family"] or "",
                target_fields=json.loads(document["target_fields_json"]),
                payload=payload,
                model=settings.openai_model,
                prompt_version=PROMPT_VERSION,
            )
            with connect(settings.database_path) as connection:
                connection.execute(
                    "UPDATE jobs SET status='candidate_ready',stage='human_review',progress=100,message='七表候选包已生成，等待人工审核',token_input=?,token_output=?,package_path=?,updated_at=? WHERE id=?",
                    (usage["input_tokens"], usage["output_tokens"], package.name, utc_now(), job_id),
                )
                connection.execute("UPDATE documents SET workflow_status='candidate_ready',updated_at=? WHERE id=?", (utc_now(), document_id))
        except Exception as error:
            with connect(settings.database_path) as connection:
                connection.execute("UPDATE jobs SET status='failed',stage='failed',message='蒸馏失败',error_message=?,updated_at=? WHERE id=?", (str(error), utc_now(), job_id))

    @app.post("/api/v1/documents/{document_id}/codex-handoff")
    def create_codex_handoff(
        document_id: int, user: dict[str, Any] = Depends(current_user)
    ) -> dict[str, Any]:
        with connect(settings.database_path) as connection:
            document = connection.execute(
                "SELECT * FROM documents WHERE id=?", (document_id,)
            ).fetchone()
            if not document:
                raise HTTPException(404, "文献不存在")
            if not document["doi_confirmed"]:
                raise HTTPException(409, "请先确认DOI和目标字段")
            fields = json.loads(document["target_fields_json"])
            task = (
                "请先读取real-materials-research根README、STATUS、DECISIONS、"
                "research/README以及research/database/EXTERNAL_DATA_COLLABORATION_PLAN.md。\n"
                f"处理论文DOI：{document['doi_confirmed']}。PDF SHA-256：{document['sha256']}。\n"
                f"目标家族：{document['target_family'] or '待核验'}；优先字段：{', '.join(fields) or '七表全部字段'}。\n"
                "请核对题目、版本与哈希，按七表Schema生成候选数据和逐字段证据；"
                "检查PL/PLE、单位、样品重复与分组。不要覆盖权威Excel或正式快照，"
                "完成后给出核心／辅助／排除／待补证据建议，等待负责人确认。"
            )
            _audit(
                connection,
                user["id"],
                "create_codex_handoff",
                "document",
                document_id,
                after={"doi": document["doi_confirmed"], "pdf_sha256": document["sha256"]},
            )
        return {
            "mode": "codex_handoff",
            "document_id": document_id,
            "doi": document["doi_confirmed"],
            "pdf_sha256": document["sha256"],
            "target_family": document["target_family"] or "",
            "target_fields": fields,
            "schema_version": "1.0",
            "authority_boundary": "candidate_only",
            "task": task,
        }

    @app.post("/api/v1/documents/{document_id}/extract")
    def start_extraction(document_id: int, payload: ExtractionInput, background: BackgroundTasks, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        if not payload.confirm_send_to_openai:
            raise HTTPException(422, "必须确认本篇PDF将发送至OpenAI API")
        with connect(settings.database_path) as connection:
            document = connection.execute("SELECT * FROM documents WHERE id=?", (document_id,)).fetchone()
            if not document:
                raise HTTPException(404, "文献不存在")
            if document["workflow_status"] != "ready_for_extraction":
                raise HTTPException(409, "请先确认DOI和目标字段")
            cursor = connection.execute(
                "INSERT INTO jobs(document_id,status,stage,progress,message,model,prompt_version,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                (document_id, "queued", "queued", 0, "任务已排队", settings.openai_model, PROMPT_VERSION, user["id"], utc_now(), utc_now()),
            )
            job_id = cursor.lastrowid
            connection.execute("UPDATE documents SET workflow_status='extracting',updated_at=? WHERE id=?", (utc_now(), document_id))
        background.add_task(run_extraction_job, job_id, document_id)
        return {"job_id": job_id, "status": "queued", "model": settings.openai_model}

    @app.get("/api/v1/jobs/{job_id}")
    def get_job(job_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        with connect(settings.database_path) as connection:
            row = connection.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, "任务不存在")
        return dict(row)

    @app.get("/api/v1/jobs/{job_id}/events")
    def job_events(job_id: int, user: dict[str, Any] = Depends(current_user)) -> StreamingResponse:
        del user
        def stream():
            with connect(settings.database_path) as connection:
                row = connection.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            if not row:
                yield "event: error\ndata: {\"message\":\"任务不存在\"}\n\n"
            else:
                yield f"event: progress\ndata: {_json(dict(row))}\n\n"
        return StreamingResponse(stream(), media_type="text/event-stream")

    @app.get("/api/v1/packages/{job_id}")
    def get_package(job_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        with connect(settings.database_path) as connection:
            job = connection.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not job or not job["package_path"]:
            raise HTTPException(404, "候选包尚未生成")
        return {"job": dict(job), **read_package(settings.candidate_root / job["package_path"])}

    @app.patch("/api/v1/packages/{job_id}/tables/{table_name}")
    def patch_table(job_id: int, table_name: str, payload: TablePatch, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        if table_name not in SEVEN_TABLE_NAMES:
            raise HTTPException(404, "七表名称无效")
        with connect(settings.database_path) as connection:
            job = connection.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not job or not job["package_path"]:
            raise HTTPException(404, "候选包尚未生成")
        schema = json.loads(settings.schema_path.read_text(encoding="utf-8"))["tables"]
        from .packages import _write_csv
        _write_csv(settings.candidate_root / job["package_path"] / "tables" / f"{table_name}.csv", schema[table_name], payload.rows)
        export_xlsx(
            settings.candidate_root / job["package_path"],
            {**schema, "field_evidence": FIELD_EVIDENCE_COLUMNS, "grouping_review": GROUPING_COLUMNS},
        )
        with connect(settings.database_path) as connection:
            _audit(connection, user["id"], "edit_candidate_table", "job", job_id, after={"table": table_name, "rows": len(payload.rows)})
        return {"ok": True, "table": table_name, "rows": len(payload.rows)}

    @app.post("/api/v1/packages/{job_id}/validate")
    def validate_candidate(job_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        with connect(settings.database_path) as connection:
            job = connection.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            location = connection.execute(
                "SELECT managed_relative_path FROM document_locations WHERE document_id=(SELECT document_id FROM jobs WHERE id=?) ORDER BY id LIMIT 1",
                (job_id,),
            ).fetchone()
        if not job or not job["package_path"]:
            raise HTTPException(404, "候选包尚未生成")
        package = settings.candidate_root / job["package_path"]
        pipeline = settings.paper_vault_root / "scripts/literature_pipeline.py"
        if pipeline.exists() and location:
            completed = subprocess.run(
                [
                    __import__("sys").executable,
                    str(pipeline),
                    "validate",
                    "--package",
                    str(package),
                    "--pdf",
                    str(settings.pdf_inbox_root / location["managed_relative_path"]),
                ],
                cwd=settings.paper_vault_root,
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
            report_path = package / "validation_report.json"
            if report_path.exists():
                report = json.loads(report_path.read_text(encoding="utf-8"))
                if report.get("valid") and completed.returncode == 0:
                    report["validated_package_sha256"] = package_hash(package)
                    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2))
                return report
            raise HTTPException(500, completed.stderr[-1000:] or "论文库校验器未生成报告")
        report = {
            "valid": all((package / "tables" / f"{name}.csv").exists() for name in SEVEN_TABLE_NAMES),
            "status": "schema_only",
            "errors": [],
            "warnings": ["未连接私有论文库，只完成七表文件存在性检查"],
        }
        (package / "validation_report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return report

    @app.post("/api/v1/packages/{job_id}/review")
    def review_package(job_id: int, payload: ReviewInput, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        if payload.decision not in {"core_candidate", "auxiliary", "exclude", "pending"}:
            raise HTTPException(422, "审核结论无效")
        if user["role"] != "owner":
            raise HTTPException(403, "只有负责人可以保存准入建议")
        with connect(settings.database_path) as connection:
            job=connection.execute('SELECT package_path FROM jobs WHERE id=?',(job_id,)).fetchone()
            if not job or not job['package_path']: raise HTTPException(404,'候选包不存在')
            package=(settings.candidate_root/job['package_path']).resolve()
            if settings.candidate_root.resolve() not in package.parents: raise HTTPException(422,'候选包路径越界')
            reviewed_hash=package_hash(package)
            cursor = connection.execute("INSERT INTO package_reviews(job_id,reviewer_id,decision,notes,created_at,reviewed_package_sha256) VALUES(?,?,?,?,?,?)", (job_id, user["id"], payload.decision, payload.notes, utc_now(),reviewed_hash))
            _audit(connection, user["id"], "review_candidate", "job", job_id, after={"decision": payload.decision, "notes": payload.notes})
        return {"review_id": cursor.lastrowid, "decision": payload.decision, "authority_database_changed": False}

    @app.get("/api/v1/database/health")
    def get_database_health(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        return database_health(settings.public_content_root, settings.candidate_root)

    @app.get("/api/v1/explorer")
    def explorer(version: str="latest",family: str="",material_form: str="",status: str="formal",user: dict[str,Any]=Depends(current_user)):
        try:return explorer_statistics(settings,version=version,family=family,material_form=material_form,status=status)
        except (ValueError,FileNotFoundError) as error:raise HTTPException(422,str(error)) from error

    @app.get("/api/v1/database/versions")
    def explorer_versions(user: dict[str,Any]=Depends(current_user)):
        return {"versions":database_versions(settings)}

    @app.post("/api/v1/database/publish")
    def publish_snapshot(payload: PublishInput,user: dict[str,Any]=Depends(current_user)):
        if user["role"]!="owner":raise HTTPException(403,"只有负责人可以发布数据库快照")
        if not payload.confirm or not payload.job_ids:raise HTTPException(422,"请选择候选包并明确确认发布")
        try:
            result=publish_database(settings,payload.job_ids,user["id"])
            with connect(settings.database_path) as db:_audit(db,user["id"],"publish_database_snapshot","snapshot",None,after=result)
            return result
        except (ValueError,FileNotFoundError) as error:raise HTTPException(422,str(error)) from error

    def run_figure_job(job_id: int, database_version: str) -> None:
        with connect(settings.database_path) as connection:
            connection.execute("UPDATE figure_jobs SET status='running',stage='validating',progress=10,message='正在校验正式数据库快照',updated_at=? WHERE id=?", (utc_now(), job_id))
        try:
            with connect(settings.database_path) as connection:
                connection.execute("UPDATE figure_jobs SET stage='rendering',progress=35,message='正在计算统计并绘制期刊级PNG',updated_at=? WHERE id=?", (utc_now(), job_id))
            manifest = render_release(settings, database_version)
            with connect(settings.database_path) as connection:
                connection.execute("UPDATE figure_jobs SET status='complete',stage='published',progress=100,message='新图集已原子发布',release_path=?,updated_at=? WHERE id=?", (str(manifest.parent), utc_now(), job_id))
        except Exception as error:
            with connect(settings.database_path) as connection:
                connection.execute("UPDATE figure_jobs SET status='failed',stage='failed',message='生成失败，网页继续保留上一正式图集',error_message=?,updated_at=? WHERE id=?", (str(error), utc_now(), job_id))

    @app.post("/api/v1/figures/render")
    def start_figure_render(background: BackgroundTasks, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        if user["role"] != "owner":
            raise HTTPException(403, "只有负责人可以发布正式数据库科研图")
        source_version = str(database_health(settings.public_content_root, settings.candidate_root)["version"])
        version = database_release_version(source_version)
        with connect(settings.database_path) as connection:
            connection.execute('BEGIN IMMEDIATE')
            active = connection.execute("SELECT id FROM figure_jobs WHERE status IN ('queued','running') ORDER BY id DESC LIMIT 1").fetchone()
            if active:
                raise HTTPException(409, {"message":"已有绘图任务正在进行", "job_id":active['id']})
            cursor = connection.execute("INSERT INTO figure_jobs(status,stage,progress,message,database_version,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", ("queued", "queued", 0, "科研图任务已排队", version, user["id"], utc_now(), utc_now()))
            job_id = cursor.lastrowid
            _audit(connection, user["id"], "render_database_figures", "figure_job", job_id, after={"database_version": version})
        background.add_task(run_figure_job, job_id, version)
        return {"job_id": job_id, "status": "queued", "database_version": version}

    @app.get("/api/v1/figures/jobs/{job_id}")
    def get_figure_job(job_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        with connect(settings.database_path) as connection:
            row = connection.execute("SELECT * FROM figure_jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, "科研图任务不存在")
        return dict(row)

    @app.get("/api/v1/figures/releases/latest")
    def get_latest_figures(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        try:
            return latest_release(settings)
        except FileNotFoundError as error:
            raise HTTPException(404, str(error)) from error

    @app.get("/api/v1/figures/releases/{version}/manifest")
    def get_figure_manifest(version: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        try:
            return manifest_for(settings, version)
        except (FileNotFoundError, ValueError) as error:
            raise HTTPException(404, "科研图版本不存在") from error

    @app.get("/api/v1/figures/releases/{version}/assets/{asset_path:path}")
    def get_figure_asset(version: str, asset_path: str, user: dict[str, Any] = Depends(current_user)) -> FileResponse:
        del user
        try:
            target = resolve_asset(settings, version, asset_path)
        except (FileNotFoundError, ValueError) as error:
            raise HTTPException(404, "科研图资源不存在") from error
        return FileResponse(target, media_type="image/png" if target.suffix.lower() == ".png" else "text/csv")

    @app.get("/api/v1/literature/priorities")
    def literature_priorities(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        del user
        return {"items": PRIORITY_DOIS, "count": len(PRIORITY_DOIS), "rule": "优先补主流家族独立DOI，再补连续系列和结构字段"}

    return app


app = create_app()
