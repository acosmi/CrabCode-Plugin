#!/usr/bin/env python3
"""镜像上某个 SHA 的一整套字节是否**自洽**且 `latest` 正指向它 —— 一个判据，两处调用。

W-PUBLISH-PROVENANCE-GATE PR-1（2026-08-17）。
立项真源：acosmi/crabcode-source `docs/audit/2026-08-17-发布来源门缺失-立项审计与实施路径.md` §3.5 / §4

## 为什么要把它抽出来

`publish-to-cn-mirror.yml` 现在有两个地方问同一个问题：

  1. **发布前的幂等早退** —— 目标 SHA 的东西已经在镜像上且自洽？那就一个字节都别再传。
  2. **发布后的验收** —— 刚传上去的东西自洽吗？

它们必须是**同一个判据**。写两份就是本立项在治的那个病（生产侧与消费侧各写一份判据，
各自演化），只不过缩小到一个文件之内。

## 幂等早退不是省事项，是关掉一条危害链（§3.5）

zip 按**源 SHA 定址**（`${SHA}.zip`）⇒ 重跑同一个 SHA = **同名对象重写**；而 zip 字节
对 mtime 敏感（checkout 的 mtime 就是本次 checkout 的时刻，同内容不同 mtime ⇒ sha256
必不同）；而镜像给 `*.zip` 发 `Cache-Control: public, max-age=31536000, immutable`
⇒ 缓存层可以永远持有旧字节，而 `.sha256` sidecar 已经换成新的 ⇒ **「缓存 zip × 新
sidecar」撕裂对**，客户端摘要校验 fail-closed 回退 git。校验侧没错，是发布侧逼它触发。

旧发布器（acosmi/crabcode-source `sync-plugins-to-mirror.yml`，2026-08-17 退役）确有一个
早退 guard，但整段包在 `if github.event_name == "schedule"` 里，而那个 schedule 早在
2026-07-27 就被删了 —— **guard 是死代码**。载体死了，危害没死：迁到本仓的新发布器
`workflow_dispatch` 补发轨原样继承了它。所以早退必须对**全部触发路径**生效。

## 判据（与发布后验收逐条同一套）

  * `latest`（带 `Cache-Control: no-cache` 取）逐字节等于目标 SHA
  * `${SHA}.zip`、`${SHA}.zip.sha256`、`marketplace.json`、`marketplace.json.sha256` 全部可达
  * 两个 `.sha256` 的形态过审计器同款正则 `([0-9a-f]{64})␠␠([A-Za-z0-9._-]+)\n?`
    （**恰两个空格 + 纯 basename**），且记录里的文件名就是它自己的载荷名
  * 两个摘要与镜像上**真实字节**逐位相符 —— 只断言 HTTP 200 只能证明「有个文件在那」
  * `marketplace.json` 的 `plugins` 非空（防半包发布给网站）

出口码：0 = 全过；1 = 任一条不过（原因打到 stderr）。
调用方自己决定 1 意味着什么：发布前 = 「还得发」，发布后 = 「这次发版红」。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request

CHECKSUM_RE = re.compile(r"([0-9a-f]{64})  ([A-Za-z0-9._-]+)\n?")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def fetch(url: str, *, no_cache: bool = False, attempts: int = 4) -> bytes:
    """取一个 URL。**4xx 不重试** —— 它是确定性答案不是瞬态。

    这条很重要:发布前的幂等预检在「这个 SHA 还没发过」时命中的正是 404,而那是
    最常见的一条路径。把 404 当瞬态退避重试,既白等十几秒,又把「还没发」说成
    「不可达」—— 判据的语义会跟着退化。
    """
    last: Exception | None = None
    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(url)
        if no_cache:
            request.add_header("Cache-Control", "no-cache")
            request.add_header("Pragma", "no-cache")
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if 400 <= error.code < 500:
                raise RuntimeError(f"{url} → HTTP {error.code}") from error
            last = error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last = error
        if attempt < attempts:
            time.sleep(attempt * 2)
    raise RuntimeError(f"不可达 {url}: {last}")


def verify(base: str, sha: str) -> list[str]:
    problems: list[str] = []
    base = base.rstrip("/")
    if SHA_RE.fullmatch(sha) is None:
        return [f"目标 SHA 形态不合法: {sha!r}"]

    try:
        pointer = fetch(f"{base}/latest", no_cache=True)
    except RuntimeError as error:
        return [str(error)]
    if pointer.strip() != sha.encode("ascii"):
        problems.append(f"latest = {pointer!r}，不等于目标 {sha}")

    payloads: dict[str, bytes] = {}
    for name in (f"{sha}.zip", "marketplace.json"):
        for suffix in ("", ".sha256"):
            url = f"{base}/{name}{suffix}"
            try:
                payloads[f"{name}{suffix}"] = fetch(url)
            except RuntimeError as error:
                problems.append(str(error))
    if problems:
        return problems

    for name in (f"{sha}.zip", "marketplace.json"):
        record = payloads[f"{name}.sha256"].decode("ascii", errors="replace")
        match = CHECKSUM_RE.fullmatch(record)
        if match is None:
            problems.append(f"{name}.sha256 形态不合审计器正则: {record!r}")
            continue
        if match.group(2) != name:
            problems.append(f"{name}.sha256 指向了别的文件名: {match.group(2)}")
            continue
        actual = hashlib.sha256(payloads[name]).hexdigest()
        if actual != match.group(1):
            problems.append(f"{name} 的摘要与镜像字节不符（记录 {match.group(1)}，实际 {actual}）")

    try:
        index = json.loads(payloads["marketplace.json"].decode("utf-8"))
        if not isinstance(index.get("plugins"), list) or not index["plugins"]:
            problems.append("镜像 marketplace.json 的 plugins 为空")
    except (ValueError, AttributeError) as error:
        problems.append(f"镜像 marketplace.json 不是合法 JSON: {error}")

    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="镜像插件前缀（不带尾斜杠）")
    parser.add_argument("--sha", required=True, help="目标源 SHA（40 位小写十六进制）")
    args = parser.parse_args(argv)

    problems = verify(args.base, args.sha)
    if problems:
        for problem in problems:
            print(f"✗ {problem}", file=sys.stderr)
        return 1
    print(f"✓ 镜像在 {args.sha} 上自洽：latest 指针 / zip / marketplace.json / 两个摘要全部相符")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
