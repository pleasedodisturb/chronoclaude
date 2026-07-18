#!/usr/bin/env bash
# Generates a synthetic Claude Code transcript so the /timestamps timeline demo
# can be reproduced without exposing a real session. The content is fabricated;
# the JSONL format matches what Claude Code writes. Run it, then from the same
# directory run:  bash scripts/timeline.sh 8
#
# Writes to ~/.claude/projects/<mangled-cwd>/demo-session.jsonl with each entry's
# `cwd` set to the directory you run this from, so timeline.sh's cwd-matching
# finds it. Safe to delete the created project dir afterwards.
set -euo pipefail

here="$PWD"
mangled="${here//\//-}"
proj="$HOME/.claude/projects/${mangled}"
mkdir -p "$proj"

python3 - "$proj/demo-session.jsonl" "$here" <<'PY'
import json, sys
path, cwd = sys.argv[1], sys.argv[2]
rows = [
 ("2026-07-18T14:02:11Z","user","Add rate limiting to the /login endpoint"),
 ("2026-07-18T14:03:40Z","assistant","On it — I'll add a token-bucket limiter middleware and wire it into the login route."),
 ("2026-07-18T14:19:55Z","user","Make it per-IP, 5 attempts per minute"),
 ("2026-07-18T14:21:07Z","assistant","Done. Per-IP bucket, 5/min, returns 429 with a Retry-After header. Added tests."),
 ("2026-07-18T14:47:31Z","user","tests are green? and did you handle IPv6?"),
 ("2026-07-18T14:48:12Z","assistant","All 12 tests pass. IPv6 normalized to /64 so a single client can't rotate addresses."),
 ("2026-07-18T15:26:03Z","user","ship it"),
 ("2026-07-18T15:27:18Z","assistant","Committed and pushed on branch feat/login-rate-limit, opened PR #214."),
]
with open(path, "w") as f:
    for ts, typ, text in rows:
        f.write(json.dumps({"type": typ, "timestamp": ts, "cwd": cwd,
                            "message": {"content": text}}) + "\n")
print(f"wrote {len(rows)} entries -> {path}")
PY
