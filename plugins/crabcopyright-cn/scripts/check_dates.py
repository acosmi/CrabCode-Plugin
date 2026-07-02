#!/usr/bin/env python3
"""软著申请日期逻辑校验。

红线见 apply-core/GUIDE.md §6:开发完成日期 ≤ 首次发表日期;
企业申请时开发完成日期不得早于企业成立日期;各日期不得晚于申请日期。

用法:
    python3 check_dates.py --dev-complete 2026-03-01 [--first-publish 2026-04-01|未发表]
        [--apply-date 2026-07-01] [--company-established 2020-06-18] [--json]
    python3 check_dates.py --manifest outputs/<申请名>/manifest.json [--json]

--manifest 从 manifest 的 dates 字段读取,命令行参数优先。日期接受
YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD / YYYY年MM月DD日。
"""
import datetime
import json
import sys

UNPUBLISHED = {"", "未发表", None}
DATE_FORMATS = ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y年%m月%d日")


def parse_date(s):
    for fmt in DATE_FORMATS:
        try:
            return datetime.datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    raise ValueError(f"无法解析日期: {s!r}")


def run_check(dev_complete, first_publish=None, apply_date=None, company_established=None):
    """按 GUIDE.md §6 校验日期先后关系。first_publish 为 None/空/'未发表' 表示未发表。"""
    items = []
    dev = parse_date(dev_complete)
    apply_d = parse_date(apply_date) if apply_date not in UNPUBLISHED else datetime.date.today()
    pub = None if first_publish in UNPUBLISHED else parse_date(first_publish)
    est = None if company_established in UNPUBLISHED else parse_date(company_established)

    if pub is not None and dev > pub:
        items.append({"level": "fail",
                      "message": f"首次发表日期 {pub} 早于开发完成日期 {dev}(红线:开发完成 ≤ 首次发表)"})
    if dev > apply_d:
        items.append({"level": "fail",
                      "message": f"开发完成日期 {dev} 晚于申请日期 {apply_d}"})
    if pub is not None and pub > apply_d:
        items.append({"level": "fail",
                      "message": f"首次发表日期 {pub} 晚于申请日期 {apply_d}"})
    if est is not None and est > dev:
        items.append({"level": "fail",
                      "message": f"开发完成日期 {dev} 早于企业成立日期 {est}(企业申请红线)"})
    if not items:
        items.append({"level": "info", "message": "日期先后关系全部满足"})

    status = "fail" if any(i["level"] == "fail" for i in items) else "pass"
    return {
        "check": "date-logic",
        "status": status,
        "summary": f"开发完成 {dev} / 首次发表 {pub or '未发表'} / 申请 {apply_d}"
                   + (f" / 企业成立 {est}" if est else ""),
        "items": items,
        "data": {"dev_complete": str(dev), "first_publish": str(pub) if pub else "未发表",
                 "apply_date": str(apply_d),
                 "company_established": str(est) if est else None},
    }


def print_report(result):
    print(f"[{result['status'].upper()}] {result['check']} — {result['summary']}")
    for it in result["items"]:
        print(f"  - ({it['level']}) {it['message']}")


def main(argv):
    as_json = "--json" in argv
    args = [a for a in argv if a != "--json"]
    opts = {}
    i = 0
    while i < len(args):
        if args[i].startswith("--") and i + 1 < len(args):
            opts[args[i][2:]] = args[i + 1]
            i += 2
        else:
            print(__doc__.strip(), file=sys.stderr)
            return 2

    dates = {}
    if "manifest" in opts:
        with open(opts["manifest"], encoding="utf-8") as fh:
            dates = json.load(fh).get("dates", {})
    dev = opts.get("dev-complete") or dates.get("dev_complete")
    if not dev:
        print("缺少开发完成日期(--dev-complete 或 manifest.dates.dev_complete)", file=sys.stderr)
        return 2
    try:
        result = run_check(
            dev,
            first_publish=opts.get("first-publish") or dates.get("first_publish"),
            apply_date=opts.get("apply-date") or dates.get("apply_date"),
            company_established=opts.get("company-established") or dates.get("company_established"),
        )
    except ValueError as e:
        print(f"日期解析错误: {e}", file=sys.stderr)
        return 2
    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_report(result)
    return 1 if result["status"] == "fail" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
