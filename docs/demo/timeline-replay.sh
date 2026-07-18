#!/usr/bin/env bash
# Deterministic replay of a REAL `scripts/timeline.sh` run, for the demo GIF.
# The timeline below is verbatim output from timeline.sh on the synthetic session
# produced by docs/demo/make-demo-transcript.sh (fabricated content, real format,
# real parser). Replayed (not re-executed) so the GIF renders fast and identically.
# Regenerate the GIF with:  vhs docs/demo/timeline-demo.tape
set -euo pipefail

g() { printf '\033[38;5;108m%s\033[0m\n' "$1"; }   # green (prompt)
d() { printf '\033[38;5;245m%s\033[0m\n' "$1"; }   # dim (comment)

sleep 0.15   # lead-in; the tape hides `clear` before revealing

d "# zero-token session timeline — no model turn, no tokens spent"
g "\$ bash scripts/timeline.sh 8"
sleep 0.7
cat <<'EOF'

--- Message Timeline ---

EOF
sleep 0.2
print_row() { printf '%s\n' "$1"; sleep 0.18; }
print_row "16:02  You     Add rate limiting to the /login endpoint"
print_row "16:03  Claude  On it — I'll add a token-bucket limiter middleware and wire it into the login..."
print_row "16:19  You     Make it per-IP, 5 attempts per minute"
print_row "16:21  Claude  Done. Per-IP bucket, 5/min, returns 429 with a Retry-After header. Added tests."
print_row "16:47  You     tests are green? and did you handle IPv6?"
print_row "16:48  Claude  All 12 tests pass. IPv6 normalized to /64 so a single client can't rotate add..."
print_row "17:26  You     ship it"
print_row "17:27  Claude  Committed and pushed on branch feat/login-rate-limit, opened PR #214."
printf '\n'
d "Showing 8 of 8 messages."
sleep 2.0
