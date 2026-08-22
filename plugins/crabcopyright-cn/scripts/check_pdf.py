#!/usr/bin/env python3
"""软著 PDF 成品基础验收。

第一性原理:最终上传平台的是 PDF,所以必须直接检查 PDF 本身。
脚本优先使用 pdfplumber 抽取页数、页面尺寸和文本;没有该库时退化为 PDF 头和页对象粗检。

用法:
    python3 check_pdf.py <PDF路径> --name <软件全称> --version <版本号>
        [--kind source|manual|generic] [--expected-pages N] [--max-pages N] [--json]
"""
import json
import os
import re
import sys

try:
    import pdfplumber  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    pdfplumber = None

A4_WIDTH = 595.28
A4_HEIGHT = 841.89
A4_TOLERANCE = 24.0


def parse_opts(argv):
    opts = {"kind": "generic", "expected_pages": None, "max_pages": None}
    positional = []
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--json":
            opts["json"] = True
            i += 1
        elif arg in {"--name", "--version", "--kind", "--expected-pages", "--max-pages"} and i + 1 < len(argv):
            key = arg[2:].replace("-", "_")
            opts[key] = argv[i + 1]
            i += 2
        else:
            positional.append(arg)
            i += 1
    if len(positional) != 1 or not opts.get("name") or not opts.get("version"):
        raise ValueError("参数不足")
    if opts.get("expected_pages") is not None:
        opts["expected_pages"] = int(opts["expected_pages"])
    if opts.get("max_pages") is not None:
        opts["max_pages"] = int(opts["max_pages"])
    opts["path"] = positional[0]
    return opts


def page_count_fallback(data):
    # Avoid counting /Pages as /Page.
    return len(re.findall(rb"/Type\s*/Page(?!s)", data))


def is_a4(width, height):
    portrait = abs(width - A4_WIDTH) <= A4_TOLERANCE and abs(height - A4_HEIGHT) <= A4_TOLERANCE
    landscape = abs(width - A4_HEIGHT) <= A4_TOLERANCE and abs(height - A4_WIDTH) <= A4_TOLERANCE
    return portrait or landscape


def read_with_pdfplumber(path):
    with pdfplumber.open(path) as pdf:
        page_count = len(pdf.pages)
        page_texts = []
        non_a4 = []
        for idx, page in enumerate(pdf.pages):
            if not is_a4(float(page.width), float(page.height)):
                non_a4.append({"page": idx + 1, "width": round(float(page.width), 2),
                                "height": round(float(page.height), 2)})
            try:
                text = page.extract_text() or ""
                # Header-only crop: keep the first body line out so page-number checks
                # cannot accidentally pass on a numeric code literal near the top.
                header_height = min(float(page.height) * 0.08, 54.0)
                header = page.crop((0, 0, float(page.width), header_height)).extract_text() or ""
                page_texts.append({"page": idx + 1, "text": text, "header": header})
            except Exception:
                page_texts.append({"page": idx + 1, "text": "", "header": ""})
        return page_count, non_a4, page_texts


def run_check(path, name, version, kind="generic", expected_pages=None, max_pages=None):
    items = []
    data = {"path": os.path.abspath(path), "kind": kind, "reader": "fallback"}

    if not os.path.isfile(path):
        return {"check": "pdf-final", "status": "fail", "summary": "PDF 文件不存在",
                "items": [{"level": "fail", "message": f"PDF 文件不存在: {path}"}], "data": data}
    size = os.path.getsize(path)
    data["size"] = size
    if size == 0:
        items.append({"level": "fail", "message": f"PDF 文件为空: {path}"})

    with open(path, "rb") as fh:
        head = fh.read(8)
        fh.seek(0)
        blob = fh.read()
    if not head.startswith(b"%PDF-"):
        items.append({"level": "fail", "message": f"文件不是标准 PDF 头: {path}"})

    page_count = page_count_fallback(blob)
    non_a4 = []
    page_texts = []
    if pdfplumber is not None and head.startswith(b"%PDF-"):
        try:
            page_count, non_a4, page_texts = read_with_pdfplumber(path)
            data["reader"] = "pdfplumber"
        except Exception as exc:
            items.append({"level": "warn", "message": f"pdfplumber 无法解析 PDF,仅执行弱校验: {exc}"})

    data["pages"] = page_count
    if page_count <= 0:
        items.append({"level": "fail", "message": "未识别到 PDF 页面"})
    if expected_pages is not None and page_count != expected_pages:
        items.append({"level": "fail", "message": f"PDF 页数 {page_count} 与预期 {expected_pages} 不一致"})
    if max_pages is not None and page_count > max_pages:
        items.append({"level": "fail", "message": f"PDF 页数 {page_count} 超过上限 {max_pages}"})
    if size < 1024:
        items.append({"level": "warn", "message": f"PDF 文件过小({size} 字节),请确认不是空白或占位文件"})
    if non_a4:
        sample = ", ".join(f"第{x['page']}页 {x['width']}x{x['height']}" for x in non_a4[:5])
        items.append({"level": "warn", "message": f"发现非 A4 尺寸页面: {sample}"})
    data["non_a4_pages"] = non_a4[:20]

    if page_texts:
        missing_name = [p["page"] for p in page_texts if name not in p["text"]]
        missing_version = [p["page"] for p in page_texts if version not in p["text"]]
        empty_text = [p["page"] for p in page_texts if not p["text"].strip()]
        if empty_text:
            items.append({"level": "warn", "message": f"页面无法提取文本: {empty_text},请人工核验页眉页码"})
        if missing_name:
            items.append({"level": "fail", "message": f"页面未发现软件全称页眉/文本: {missing_name}"})
        if missing_version:
            items.append({"level": "fail", "message": f"页面未发现版本号页眉/文本: {missing_version}"})
        missing_header_name = [p["page"] for p in page_texts if name not in p["header"]]
        missing_header_version = [p["page"] for p in page_texts if version not in p["header"]]
        if kind == "source" and missing_header_name:
            items.append({"level": "fail", "message": f"源码 PDF 页眉区域未发现软件全称: {missing_header_name}"})
        if kind == "source" and missing_header_version:
            items.append({"level": "fail", "message": f"源码 PDF 页眉区域未发现版本号: {missing_header_version}"})

        missing_page_numbers = []
        for page in page_texts:
            number = str(page["page"])
            header = page["header"]
            if not re.search(rf"(?<!\d){re.escape(number)}(?!\d)", header):
                missing_page_numbers.append(page["page"])
        if missing_page_numbers:
            items.append({"level": "warn", "message": f"页眉区域未可靠识别连续页码，请视觉复核: {missing_page_numbers}"})
        data["pages_text"] = [
            {"page": p["page"], "chars": len(p["text"]), "header_chars": len(p["header"])}
            for p in page_texts
        ]
    elif pdfplumber is None:
        items.append({"level": "warn", "message": "未安装 pdfplumber,无法抽取文本核验页眉名称和版本号"})
    else:
        items.append({"level": "warn", "message": "未能抽取 PDF 文本,请人工核验页眉名称和版本号"})

    if not items:
        items.append({"level": "info", "message": "PDF 基础验收通过"})

    if any(i["level"] == "fail" for i in items):
        status = "fail"
    elif any(i["level"] == "warn" for i in items):
        status = "warn"
    else:
        status = "pass"
    return {"check": f"pdf-final:{kind}", "status": status,
            "summary": f"{page_count} 页 / {size} 字节 / reader={data['reader']}",
            "items": items, "data": data}


def print_report(result):
    print(f"[{result['status'].upper()}] {result['check']} — {result['summary']}")
    for item in result["items"]:
        print(f"  - ({item['level']}) {item['message']}")


def main(argv):
    try:
        opts = parse_opts(argv)
    except (ValueError, TypeError):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    result = run_check(opts["path"], opts["name"], opts["version"],
                       kind=opts.get("kind", "generic"),
                       expected_pages=opts.get("expected_pages"),
                       max_pages=opts.get("max_pages"))
    if opts.get("json"):
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_report(result)
    return 1 if result["status"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
