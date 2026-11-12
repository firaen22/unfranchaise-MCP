#!/usr/bin/env bash
# All subordinate dispatches for this repo use reasoning effort medium only.
set -euo pipefail
EFFORT="${UNF_DISPATCH_EFFORT:-medium}"
case "$EFFORT" in
  medium) ;;
  *)
    echo "UNF_DISPATCH_EFFORT must be medium (got: $EFFORT)" >&2
    exit 2
    ;;
esac
exec python3 ~/.claude/lib/dispatch.py "$@" --effort "$EFFORT"
