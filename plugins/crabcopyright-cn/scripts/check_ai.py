#!/usr/bin/env python3
"""Fail-closed AI-assistance/provenance gate for final soft-copyright filing.

Usage:
    python3 check_ai.py --manifest <manifest.json> [--json]
"""

from __future__ import annotations

import json
import sys

from manifest_contract import result, status_from_items

TRI_STATE = {"yes", "no", "unknown"}


def run_check(manifest):
    ai = manifest.get("ai_assistance")
    items = []
    data = {}
    if not isinstance(ai, dict):
        return result("ai-assistance", "fail", "缺少 AI 使用事实记录",
                      [{"level": "blocked", "message": "manifest.ai_assistance 缺失；不得输出可提交结论"}], {})

    for key in ("code", "manual", "application_materials"):
        value = ai.get(key)
        data[key] = value
        if value not in TRI_STATE:
            items.append({"level": "blocked", "message": f"ai_assistance.{key} 必须是 yes/no/unknown"})
        elif value == "unknown":
            items.append({"level": "blocked", "message": f"ai_assistance.{key}=unknown，须由申请人确认真实情况"})
        elif value == "yes":
            items.append({"level": "blocked", "message": f"ai_assistance.{key}=yes，与当前新版申请表公开转述的未使用 AI 承诺存在冲突"})

    used = ai.get("current_workflow_used_ai")
    acknowledged = ai.get("applicant_acknowledged")
    provenance = ai.get("provenance")
    data.update({"current_workflow_used_ai": used, "applicant_acknowledged": acknowledged,
                 "provenance_count": len(provenance) if isinstance(provenance, list) else None})
    if not isinstance(used, bool):
        items.append({"level": "blocked", "message": "current_workflow_used_ai 必须是布尔值"})
    elif used:
        items.append({"level": "blocked", "message": "当前工作流已使用 AI 生成/改写申请材料；不得指导作出相反承诺"})
    if not isinstance(provenance, list):
        items.append({"level": "fail", "message": "ai_assistance.provenance 必须是数组"})
    if acknowledged is not True:
        items.append({"level": "blocked", "message": "申请人尚未确认 AI 使用事实(applicant_acknowledged != true)"})

    if not items:
        items.append({"level": "info", "message": "申请人已确认 AI 使用事实，当前记录未显示 AI 参与代码或申请材料生成"})
    status = status_from_items(items)
    return result("ai-assistance", status,
                  f"{len([x for x in items if x['level'] in {'fail', 'blocked'}])} 个阻断项", items, data)


def main(argv):
    as_json = "--json" in argv
    args = [arg for arg in argv if arg != "--json"]
    if len(args) != 2 or args[0] != "--manifest":
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        with open(args[1], encoding="utf-8") as handle:
            manifest = json.load(handle)
        report = run_check(manifest)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"执行失败: {exc}", file=sys.stderr)
        return 2
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"[{report['status'].upper()}] {report['check']} — {report['summary']}")
        for item in report["items"]:
            print(f"  - ({item['level']}) {item['message']}")
    return 1 if report["status"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
