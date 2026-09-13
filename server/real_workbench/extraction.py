from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Protocol

from openai import OpenAI

from .packages import FIELD_EVIDENCE_COLUMNS, GROUPING_COLUMNS, SEVEN_TABLE_NAMES


PROMPT_VERSION = "real-seven-table-v1.0"


class ExtractionProvider(Protocol):
    def extract(
        self,
        *,
        pdf_path: Path,
        doi: str,
        target_family: str,
        target_fields: list[str],
        schema: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, int]]: ...


def output_schema(table_schema: dict[str, list[str]]) -> dict[str, Any]:
    def row_schema(columns: list[str]) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {column: {"type": ["string", "null"]} for column in columns},
            "required": columns,
            "additionalProperties": False,
        }

    table_properties = {
        name: {"type": "array", "items": row_schema(table_schema[name])}
        for name in SEVEN_TABLE_NAMES
    }
    return {
        "type": "object",
        "properties": {
            "paper_map": {
                "type": "object",
                "properties": {
                    "title": {"type": ["string", "null"]},
                    "authors": {"type": ["string", "null"]},
                    "journal": {"type": ["string", "null"]},
                    "year": {"type": ["string", "null"]},
                    "material_scope": {"type": ["string", "null"]},
                    "sample_series_summary": {"type": ["string", "null"]},
                },
                "required": ["title", "authors", "journal", "year", "material_scope", "sample_series_summary"],
                "additionalProperties": False,
            },
            "tables": {
                "type": "object",
                "properties": table_properties,
                "required": list(SEVEN_TABLE_NAMES),
                "additionalProperties": False,
            },
            "field_evidence": {"type": "array", "items": row_schema(FIELD_EVIDENCE_COLUMNS)},
            "grouping_review": {"type": "array", "items": row_schema(GROUPING_COLUMNS)},
            "admission_summary": {"type": "string"},
            "missing_evidence": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["paper_map", "tables", "field_evidence", "grouping_review", "admission_summary", "missing_evidence"],
        "additionalProperties": False,
    }


def extraction_prompt(doi: str, target_family: str, target_fields: list[str]) -> str:
    return f"""你是REAL科研数据库的数据蒸馏Agent。读取所附论文PDF，将结果整理为七张候选表。

输入DOI：{doi}
目标材料家族：{target_family or '待判断'}
优先字段：{', '.join(target_fields) or '组成与室温PL'}

规则：
1. 先核对题目、DOI、版本和样品系列，再枚举全部真实样品。
2. 一行sample_master代表一个真实制备样品；同一样品的不同测量写入optical_measurement多行。
3. 区分ceramic、transparent_ceramic、powder、single_crystal、glass_ceramic、device和unknown。
4. PL主峰来自发射光谱；PL测试激发波长不等于PLE峰；吸收、XRL、EL不能冒充室温PL。
5. 每个数值字段在field_evidence登记页码、Figure/Table、提取方式、单位和source_id。
6. 论文直接值、图估读、化学式计算、CIF计算、数据库值、模型派生值必须分开标注。
7. 只有原子坐标、键长表或CIF才能计算A–O、AO8体积和畸变；普通XRD曲线不能生成局域结构数值。
8. 缺失保持null，禁止用0、经验值或猜测补齐。
9. 同一DOI、连续系列、完全相同组成和材料家族给出分组建议。
10. 所有结果只是候选，admission_summary说明建议core_candidate、auxiliary、exclude或pending及理由。
"""


class OpenAIExtractionProvider:
    def __init__(self, model: str) -> None:
        self.model = model

    def extract(
        self,
        *,
        pdf_path: Path,
        doi: str,
        target_family: str,
        target_fields: list[str],
        schema: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, int]]:
        if not os.environ.get("OPENAI_API_KEY"):
            raise RuntimeError("本机尚未配置OPENAI_API_KEY；请在启动REAL前于终端安全设置。")
        client = OpenAI()
        with pdf_path.open("rb") as stream:
            uploaded = client.files.create(file=stream, purpose="user_data")
        try:
            response = client.responses.create(
                model=self.model,
                input=[{
                    "role": "user",
                    "content": [
                        {"type": "input_file", "file_id": uploaded.id},
                        {"type": "input_text", "text": extraction_prompt(doi, target_family, target_fields)},
                    ],
                }],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "real_literature_extraction",
                        "strict": True,
                        "schema": output_schema(schema["tables"]),
                    }
                },
            )
            payload = json.loads(response.output_text)
            usage = getattr(response, "usage", None)
            return payload, {
                "input_tokens": int(getattr(usage, "input_tokens", 0) or 0),
                "output_tokens": int(getattr(usage, "output_tokens", 0) or 0),
            }
        finally:
            try:
                client.files.delete(uploaded.id)
            except Exception:
                pass
