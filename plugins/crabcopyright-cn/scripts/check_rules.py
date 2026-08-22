#!/usr/bin/env python3
"""Validate the machine-readable crabcopyright-cn rule registry using stdlib only.

Usage:
    python3 check_rules.py [--rules <rules.json>] [--json]
"""

from __future__ import annotations

import datetime as dt
import json
import sys
from urllib.parse import urlparse

from manifest_contract import RULES_PATH, RULES_VERSION, load_json, result, status_from_items

KINDS = {"official", "platform", "practice"}
SEVERITIES = {"info", "warn", "fail", "blocked"}
REQUIRED = {
    "id", "kind", "title", "source_url", "effective_from",
    "effective_to", "last_verified_at", "severity", "mechanical_check", "notes",
}


def parse_date(value, field, rule_id):
    if value is None and field == "effective_to":
        return None
    try:
        return dt.date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValueError(f"规则 {rule_id} 的 {field} 不是 YYYY-MM-DD: {value!r}")


def run_check(path=RULES_PATH):
    registry = load_json(path)
    items = []
    rules = registry.get("rules")
    if registry.get("registry_version") != 1:
        items.append({"level": "fail", "message": "registry_version 必须为 1"})
    if registry.get("rules_version") != RULES_VERSION:
        items.append({"level": "fail", "message": f"rules_version 必须为 {RULES_VERSION}"})
    try:
        dt.date.fromisoformat(registry.get("verified_at", ""))
    except (TypeError, ValueError):
        items.append({"level": "fail", "message": "verified_at 必须为 YYYY-MM-DD"})
    if not isinstance(rules, list) or not rules:
        items.append({"level": "fail", "message": "rules 必须是非空数组"})
        rules = []

    seen = set()
    for index, rule in enumerate(rules):
        rule_id = rule.get("id", f"#{index}") if isinstance(rule, dict) else f"#{index}"
        if not isinstance(rule, dict):
            items.append({"level": "fail", "message": f"规则 {rule_id} 不是对象"})
            continue
        missing = sorted(REQUIRED - set(rule))
        extra = sorted(set(rule) - REQUIRED)
        if missing:
            items.append({"level": "fail", "message": f"规则 {rule_id} 缺字段: {', '.join(missing)}"})
        if extra:
            items.append({"level": "fail", "message": f"规则 {rule_id} 有未知字段: {', '.join(extra)}"})
        if rule_id in seen:
            items.append({"level": "fail", "message": f"规则 ID 重复: {rule_id}"})
        seen.add(rule_id)
        if rule.get("kind") not in KINDS:
            items.append({"level": "fail", "message": f"规则 {rule_id} kind 无效"})
        if rule.get("severity") not in SEVERITIES:
            items.append({"level": "fail", "message": f"规则 {rule_id} severity 无效"})
        if rule.get("kind") == "practice" and rule.get("severity") in {"fail", "blocked"}:
            items.append({"level": "fail", "message": f"经验规则 {rule_id} 不得直接设为 fail/blocked"})
        parsed = urlparse(rule.get("source_url", ""))
        if parsed.scheme != "https" or not parsed.netloc:
            items.append({"level": "fail", "message": f"规则 {rule_id} source_url 必须是 HTTPS"})
        try:
            start = parse_date(rule.get("effective_from"), "effective_from", rule_id)
            end = parse_date(rule.get("effective_to"), "effective_to", rule_id)
            parse_date(rule.get("last_verified_at"), "last_verified_at", rule_id)
            if end and start and end < start:
                items.append({"level": "fail", "message": f"规则 {rule_id} effective_to 早于 effective_from"})
        except ValueError as exc:
            items.append({"level": "fail", "message": str(exc)})

    if not items:
        items.append({"level": "info", "message": f"规则注册表 {RULES_VERSION} 共 {len(rules)} 条，结构有效"})
    status = status_from_items(items)
    return result("rules-registry", status, f"{len(rules)} 条规则 / {len([x for x in items if x['level'] != 'info'])} 个问题", items,
                  {"rules_version": registry.get("rules_version"), "rule_ids": sorted(seen)})


def main(argv):
    as_json = "--json" in argv
    args = [arg for arg in argv if arg != "--json"]
    path = RULES_PATH
    if args:
        if len(args) != 2 or args[0] != "--rules":
            print(__doc__.strip(), file=sys.stderr)
            return 2
        path = args[1]
    try:
        report = run_check(path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
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
