#!/usr/bin/env python3
"""Show the CrabCode Security banner for its own slash command.

Always exits 0 with either the banner or no output.
"""

import contextlib
import json
import os
import sys
from typing import Optional, cast

PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAUNCH_NOTICE = "Launching CrabCode Security..."
COMMANDS = frozenset(
    {
        "/crabcode-security",
        "/crabcode-security:crabcode-security",
        "crabcode-security:crabcode-security",
    }
)

BOX_INNER = 53

MIN_PYTHON = (3, 9)


def plugin_version() -> str:
    """The plugin's version from plugin.json, or "unknown". Never raises."""
    try:
        path = os.path.join(PLUGIN_ROOT, ".crabcode-plugin", "plugin.json")
        with open(path, encoding="utf-8") as handle:
            loaded = cast("object", json.load(handle))
    except Exception:
        return "unknown"
    if not isinstance(loaded, dict):
        return "unknown"
    version = cast("dict[str, object]", loaded).get("version")
    return version if isinstance(version, str) and version else "unknown"


def box_line(text: str) -> str:
    """One boxed body line, centered so the right border always aligns."""
    if len(text) > BOX_INNER:
        text = text[:BOX_INNER]
    return "  │" + text.center(BOX_INNER) + "│"


def bottom_border(version: str) -> str:
    """The box's bottom edge with the version set into it, right-aligned."""
    tag = f" v{version} "
    fill = BOX_INNER - len(tag) - 3
    if fill < 1:
        return "  └" + "─" * BOX_INNER + "┘"
    return "  └" + "─" * fill + tag + "─" * 3 + "┘"


def banner() -> str:
    lines = [
        "",
        "             C R A B C O D E",
        "     ─────── S · E · C · U · R · I · T · Y ───────",
        "  ┌" + "─" * BOX_INNER + "┐",
        box_line("Find and fix vulnerabilities in source code"),
        bottom_border(plugin_version()),
        "",
    ]
    return "\n".join(lines)


def emit(message: str) -> None:
    """Write one systemMessage. Never raises; a failed write is just no banner."""
    try:
        sys.stdout.write(json.dumps({"systemMessage": message}))
        sys.stdout.flush()
    except Exception:
        # Also silence the interpreter's exit-time flush of the buffered message.
        with contextlib.suppress(Exception):
            os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())


def submitted_prompt() -> Optional[str]:
    """Return the submitted prompt from a CrabCode hook payload."""
    try:
        payload = cast("object", json.load(sys.stdin))
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    prompt = cast("dict[str, object]", payload).get("prompt")
    return prompt if isinstance(prompt, str) else None


def is_security_command(prompt: Optional[str]) -> bool:
    """Match only the menu command; arguments after it are allowed."""
    if prompt is None:
        return False
    stripped = prompt.strip()
    if not stripped:
        return False
    return stripped.split(maxsplit=1)[0] in COMMANDS


def main() -> int:
    if not is_security_command(submitted_prompt()):
        return 0
    if sys.version_info < MIN_PYTHON:
        need = f"{MIN_PYTHON[0]}.{MIN_PYTHON[1]}"
        have = ".".join(str(part) for part in sys.version_info[:3])
        emit(
            f"\n\u26a0\ufe0f  CrabCode Security needs python3 {need} or newer, but this "
            f"python3 is {have}. Scanning and fixing will fail until a newer "
            "python3 is first on PATH.\n"
        )
        return 0
    try:
        message = "\n" + LAUNCH_NOTICE + "\n\n" + banner()
    except Exception:
        message = "\n" + LAUNCH_NOTICE + "\n"
    emit(message)
    return 0


if __name__ == "__main__":
    sys.exit(main())
