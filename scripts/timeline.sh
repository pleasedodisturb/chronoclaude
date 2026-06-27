#!/usr/bin/env bash
#
# timeline.sh — zero-token wrapper for the ChronoClaude /timestamps timeline.
#
# Runs scripts/parse-transcript.py straight from your shell — no model turn, no
# tokens — and prints a wall-clock timeline of the current Claude Code session.
# The transcript is located by matching the working directory recorded inside
# Claude Code's transcript files (parse-transcript.py --cwd), so it works from
# any project, including paths containing dots or spaces.
#
# Usage:
#   bash scripts/timeline.sh [count]     # count defaults to 20
#
# Run it from the project directory whose session you want to inspect.
#
# The zero-token shell-wrapper approach is adapted from
# s-a-s-k-i-a/claude-code-timestamps (MIT) — see THIRD-PARTY-LICENSES.md.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
parser="${script_dir}/parse-transcript.py"

if [ ! -f "${parser}" ]; then
  echo "Error: parser not found at ${parser}" >&2
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  python_bin="python3"
elif command -v python >/dev/null 2>&1; then
  python_bin="python"
else
  echo "Error: python3 (or python) is required to run timeline.sh" >&2
  exit 1
fi

if [ "$#" -gt 0 ]; then
  exec "${python_bin}" "${parser}" --cwd "${PWD}" "$1"
fi

exec "${python_bin}" "${parser}" --cwd "${PWD}"
