#!/usr/bin/env python3
"""软著说明书中间态结构校验。

检查 docx/txt/markdown 中是否包含软件名、版本号和说明书关键章节。
最终 PDF 仍由 check_pdf.py 验收;本脚本负责验证说明书内容骨架。

用法:
    python3 check_manual.py --manifest outputs/<申请名>/manifest.json [--json]
    python3 check_manual.py <说明书.docx|txt|md> --name <软件全称> --version <版本号> [--doc-type 用户手册|设计说明书] [--json]
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

USER_MANUAL_KEYWORDS = ["目录", "概述", "运行环境", "安装", "功能"]
DESIGN_DOC_KEYWORDS = ["引言", "总体设计", "模块", "接口"]


def resolve(base_dir, path):
    return path if os.path.isabs(path) else os.path.join(base_dir, path)


def xml_text_from_docx(path):
    parts = []
    with zipfile.ZipFile(path) as zf:
        names = [n for n in zf.namelist() if n == "word/document.xml" or
                 n.startswith("word/header") or n.startswith("word/footer")]
        for name in names:
            root = ET.fromstring(zf.read(name))
            for node in root.iter():
                if node.tag.endswith("}t") and node.text:
                    parts.append(node.text)
    return "\n".join(parts)


def read_text(path):
    lower = path.lower()
    if lower.endswith(".docx"):
        return xml_text_from_docx(path), "docx"
    if lower.endswith((".txt", ".md", ".markdown")):
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.read(), "text"
    if lower.endswith(".doc"):
        return "", "legacy-doc"
    with open(path, encoding="utf-8", errors="replace") as fh:
        return fh.read(), "text"


def pick_manual_path(manifest, base_dir):
    interm = manifest.get("intermediates", {})
    manual = manifest.get("manual", {})
    for p in (interm.get("manual_docx"), manual.get("source_path")):
        if p:
            return resolve(base_dir, p)
    return ""


def run_check(path, name, version, doc_type="用户手册", screenshot_plan=None, base_dir=None):
    items = []
    data = {"path": os.path.abspath(path) if path else "", "doc_type": doc_type}
    if not path:
        items.append({"level": "warn", "message": "未提供说明书中间态路径,无法校验章节和页眉文本"})
        return {"check": "manual-structure", "status": "warn", "summary": "未提供说明书中间态",
                "items": items, "data": data}
    if not os.path.isfile(path):
        items.append({"level": "warn", "message": f"说明书中间态文件不存在: {path}"})
        return {"check": "manual-structure", "status": "warn", "summary": "说明书中间态缺失",
                "items": items, "data": data}

    try:
        text, reader = read_text(path)
    except Exception as exc:
        items.append({"level": "warn", "message": f"无法读取说明书中间态: {exc}"})
        return {"check": "manual-structure", "status": "warn", "summary": "说明书读取失败",
                "items": items, "data": data}

    data["reader"] = reader
    data["chars"] = len(re.sub(r"\s+", "", text))
    if reader == "legacy-doc":
        items.append({"level": "warn", "message": "旧版 .doc 无法用标准库抽取文本,请先转 .docx 后复核"})
    elif not text.strip():
        items.append({"level": "warn", "message": "说明书中间态未提取到文本,请人工核验"})
    else:
        if name not in text:
            items.append({"level": "fail", "message": "说明书中间态未发现软件全称"})
        if version not in text:
            items.append({"level": "fail", "message": "说明书中间态未发现版本号"})
        keywords = DESIGN_DOC_KEYWORDS if "设计" in doc_type else USER_MANUAL_KEYWORDS
        missing = [kw for kw in keywords if kw not in text]
        data["missing_keywords"] = missing
        if missing:
            items.append({"level": "warn", "message": f"说明书可能缺少关键章节/标题: {', '.join(missing)}"})

    if screenshot_plan is not None and "设计" not in doc_type:
        count = len(screenshot_plan)
        data["screenshot_plan_count"] = count
        if count < 5:
            items.append({"level": "warn", "message": f"截图取证清单仅 {count} 项,用户手册通常应覆盖登录、主界面和核心功能"})
        invalid = []
        actual_images = 0
        external_urls = []
        for index, entry in enumerate(screenshot_plan):
            if not isinstance(entry, dict) or any(not entry.get(key) for key in ("page", "route", "url", "feature")):
                invalid.append(index + 1)
                continue
            parsed = urlparse(entry.get("url", ""))
            if parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
                external_urls.append(entry.get("url"))
            image_path = entry.get("image_path", "")
            if image_path:
                candidate = resolve(base_dir or os.path.dirname(path), image_path)
                if os.path.isfile(candidate) and os.path.getsize(candidate) > 0:
                    actual_images += 1
                else:
                    items.append({"level": "fail", "message": f"截图文件不存在或为空: {image_path}"})
        if invalid:
            items.append({"level": "fail", "message": f"截图取证清单第 {invalid} 项缺 page/route/url/feature"})
        if actual_images == 0:
            items.append({"level": "warn", "message": "截图清单尚未绑定任何实际 image_path；当前只能验收计划，不能证明说明书已有真实截图"})
        if external_urls:
            items.append({"level": "warn", "message": f"截图地址含非本地开发域名，请复核隐私与真实性: {external_urls[:5]}"})
        data["actual_screenshot_files"] = actual_images

    if not items:
        items.append({"level": "info", "message": "说明书中间态结构校验通过"})
    if any(i["level"] == "fail" for i in items):
        status = "fail"
    elif any(i["level"] == "warn" for i in items):
        status = "warn"
    else:
        status = "pass"
    return {"check": "manual-structure", "status": status,
            "summary": f"reader={data.get('reader', 'none')} / {data.get('chars', 0)} 字",
            "items": items, "data": data}


def run_manifest(manifest_path):
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    base_dir = os.path.dirname(os.path.abspath(manifest_path))
    sw = manifest.get("software", {})
    manual = manifest.get("manual", {})
    return run_check(pick_manual_path(manifest, base_dir), sw.get("full_name", ""),
                     sw.get("version", ""), doc_type=manual.get("doc_type", "用户手册"),
                     screenshot_plan=manual.get("screenshot_plan", []), base_dir=base_dir)


def parse_args(argv):
    as_json = "--json" in argv
    args = [a for a in argv if a != "--json"]
    if len(args) == 2 and args[0] == "--manifest":
        return {"manifest": args[1], "json": as_json}
    opts = {"json": as_json, "doc_type": "用户手册"}
    positional = []
    i = 0
    while i < len(args):
        if args[i] in {"--name", "--version", "--doc-type"} and i + 1 < len(args):
            opts[args[i][2:].replace("-", "_")] = args[i + 1]
            i += 2
        else:
            positional.append(args[i])
            i += 1
    if len(positional) != 1 or not opts.get("name") or not opts.get("version"):
        raise ValueError("参数不足")
    opts["path"] = positional[0]
    return opts


def print_report(result):
    print(f"[{result['status'].upper()}] {result['check']} — {result['summary']}")
    for item in result["items"]:
        print(f"  - ({item['level']}) {item['message']}")


def main(argv):
    try:
        opts = parse_args(argv)
        result = run_manifest(opts["manifest"]) if "manifest" in opts else \
            run_check(opts["path"], opts["name"], opts["version"], opts.get("doc_type", "用户手册"))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"执行失败: {exc}", file=sys.stderr)
        print(__doc__.strip(), file=sys.stderr)
        return 2
    if opts.get("json"):
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_report(result)
    return 1 if result["status"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
