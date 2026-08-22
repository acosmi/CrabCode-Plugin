#!/usr/bin/env python3
"""Bind a final PDF to its source artifact and update manifest atomically.

Usage:
    python3 record_artifact.py --manifest <manifest.json> --kind source_pdf|manual_pdf --path <file.pdf>
"""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

from manifest_contract import RULES_VERSION, atomic_write_json, contained_path, load_json, sha256_file

KINDS = {
    "source_pdf": {
        "material": "02-源代码鉴别材料.pdf",
        "source_artifact": "source_docx",
        "source_field": "source_docx_sha256",
    },
    "manual_pdf": {
        "material": "03-说明书鉴别材料.pdf",
        "source_artifact": None,
        "source_field": "manual_docx_sha256",
    },
}


def contained_file(base_dir, value):
    target = contained_path(base_dir, value, kind="file")
    if target.stat().st_size == 0:
        raise ValueError(f"最终材料不得为空: {target}")
    return target


def source_hash(manifest, base_dir, kind):
    meta = KINDS[kind]
    if meta["source_artifact"]:
        entry = manifest.get("artifacts", {}).get(meta["source_artifact"])
        if not isinstance(entry, dict) or not entry.get("sha256"):
            raise ValueError(f"缺少 artifacts.{meta['source_artifact']}，无法绑定 {kind}")
        source_path = contained_file(base_dir, Path(base_dir) / entry.get("path", ""))
        actual = sha256_file(source_path)
        if actual != entry["sha256"]:
            raise ValueError(f"{meta['source_artifact']} 已变化，请重新生成/校验")
        return actual

    manual_path = manifest.get("intermediates", {}).get("manual_docx", "")
    if not manual_path:
        raise ValueError("缺少 intermediates.manual_docx，无法绑定 manual_pdf")
    return sha256_file(contained_file(base_dir, Path(base_dir) / manual_path))


def append_log(base_dir, manifest, event):
    value = manifest.get("audit_log_path") or "audit-log.jsonl"
    log_path = contained_path(base_dir, value, kind=None, allow_missing=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": dt.datetime.now(dt.timezone.utc).isoformat(), **event}, ensure_ascii=False) + "\n")


def main(argv):
    opts = {}
    i = 0
    while i < len(argv):
        if argv[i] in {"--manifest", "--kind", "--path"} and i + 1 < len(argv):
            opts[argv[i][2:]] = argv[i + 1]
            i += 2
        else:
            print(__doc__.strip(), file=sys.stderr)
            return 2
    if set(opts) != {"manifest", "kind", "path"} or opts["kind"] not in KINDS:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        manifest_input = Path(opts["manifest"])
        if manifest_input.is_symlink():
            raise ValueError("manifest 不得是符号链接")
        manifest_path = manifest_input.resolve(strict=True)
        manifest = load_json(manifest_path)
        base_dir = manifest_path.parent
        target = contained_file(base_dir, opts["path"])
        bound_hash = source_hash(manifest, base_dir, opts["kind"])
        artifact_hash = sha256_file(target)
        relative = target.relative_to(base_dir).as_posix()
        meta = KINDS[opts["kind"]]
        artifacts = manifest.setdefault("artifacts", {})
        artifacts[opts["kind"]] = {
            "path": relative,
            "sha256": artifact_hash,
            "validated_against": {
                "rules_version": RULES_VERSION,
                meta["source_field"]: bound_hash,
            },
        }
        materials = manifest.setdefault("materials", {})
        materials[meta["material"]] = {"path": relative, "status": "✅"}
        atomic_write_json(manifest_path, manifest)
        append_log(base_dir, manifest, {
            "event": "artifact.record",
            "kind": opts["kind"],
            "path": relative,
            "sha256": artifact_hash,
            meta["source_field"]: bound_hash,
        })
        print(json.dumps(artifacts[opts["kind"]], ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"记录失败: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
