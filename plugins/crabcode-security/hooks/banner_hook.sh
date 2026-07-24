#!/bin/sh
if python3 -c 'import sys' >/dev/null 2>&1; then
  python3 "$(dirname -- "$0")/banner_notice.py"
fi
exit 0
