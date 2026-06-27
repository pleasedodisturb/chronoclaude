# Upstream sync log

ChronoClaude merges three community plugins (see [`THIRD-PARTY-LICENSES.md`](../THIRD-PARTY-LICENSES.md)
for licensing and [`README.md`](../README.md) for what each contributes). Those
projects keep moving after we forked the ideas, so this file is a periodic
record of reviewing each upstream — plus our own issues/PRs, Linear tickets, and
the origin thread `anthropics/claude-code#44763` — and what we did with each
change: **adopted**, **already have**, **not applicable**, or **deferred**.

Append a new dated section per review. Keep the most recent at the top.

---

## 2026-06-27 — review against ChronoClaude 0.5.3

One change adopted; everything else was already covered by our own
implementation, doesn't apply to our architecture, or was deferred by choice.

### clankercode/claude-inject-idle-time — the base (public domain: Unlicense / CC0)

Reviewed up to **v0.4.0** (latest commit ~2026-06-11, "all 12 brainstorm items
+ minor fixes"). We diverged from this base at the 0.5.0 rebrand and have since
rewritten most of it, so upstream's later fixes land as things we already solved
independently.

| Upstream change | Disposition | Why |
|---|---|---|
| Atomic state writes + corrupt-state recovery | **Already have** | `src/state.js` writes via `<file>.tmp` + `rename`, and `loadSessionState` quarantines a corrupt file to `<file>.json.corrupt` and returns fresh state (shipped in our 0.3.1). |
| Wire config into the idle system message | **Already have** | Our idle note is gated by `CLAUDE_TIMING_IDLE_NOTE` via `isEnabled('idleNote')` in `scripts/user-prompt-submit.js`; the whole toggle layer lives in `src/config.js`. |
| Consolidate `sanitizeSessionId` | **Already have** | Single definition in `src/state.js`, reused everywhere. |
| Concurrent hook execution fixes | **Already have / N/A** | Our hooks are fail-soft (`exit 0` on error) and state writes are atomic; we did not observe a concurrency defect to port. Revisit if a read-modify-write race is ever reported. |

### s-a-s-k-i-a/claude-code-timestamps — retrospective `/timestamps` (MIT)

Reviewed at **7 commits, no tagged releases, 0 open issues**.

| Upstream change | Disposition | Why |
|---|---|---|
| Resolve the transcript by matching the working directory recorded *inside* each transcript, not by reconstructing the `~/.claude/projects/<dir>` folder name (which breaks on paths with dots/spaces) | **ADOPTED** | We had the exact bug: `commands/timestamps.md` reconstructed the folder name with `pwd \| sed 's\|/\|-\|g'`, which only rewrites `/`. `parse-transcript.py` now takes `--cwd` and matches the `cwd` field Claude Code stamps on every entry. See PR #24 / `CHANGELOG` `[Unreleased]`. |
| Zero-token `timeline.sh` (run the parser straight from the shell, bypassing the model entirely) | **Adopted** | Added `scripts/timeline.sh`, a thin wrapper that runs `parse-transcript.py --cwd "$PWD"` directly from the shell — a truly zero-token path alongside the `haiku`-backed `/timestamps`. (Initially deferred in this review; built immediately after on maintainer request.) |

### zoharbabin/claude-code-message-timestamps — visible `[HH:MM:SS]` marker (MIT)

Reviewed up to **v1.2.0** (2026-06-15; v1.1.1 2026-06-04). 2 open issues, 3 open PRs.

| Upstream change | Disposition | Why |
|---|---|---|
| v1.1.1: remove a redundant `hooks/hooks.json` entry from the plugin manifest that caused a loader error (Claude Code auto-loads that file) | **Not applicable** | Our `.claude-plugin/plugin.json` declares **no** `hooks` field; `hooks/hooks.json` is picked up by auto-discovery only, so we never had the duplicate. |
| v1.2.0: `CLAUDE_TIMESTAMPS_INJECT_CONTEXT` env to keep the on-screen marker while opting out of model-facing context injection | **Already have (more granular)** | We separate these as independent surfaces: the visible marker (`CLAUDE_TIMING_MESSAGE_DISPLAY`, display-only) vs. the hidden timing block (`CLAUDE_TIMING_PASSIVE`). Toggle either independently. |
| Open issue: "Any way to only show time to me, not Claude?" | **Already solved** | Same as above — `MESSAGE_DISPLAY` on, `PASSIVE` off. |
| Open issue: Windows git-bash path-escape breakage | **Not applicable** | Their hook is Bash + `jq`; our `scripts/message-display.js` is Node, so it isn't exposed to git-bash path escaping. |

### Our repo, tickets & mentions

- **GitHub issues:** none open. **PRs:** #16 is intentionally **parked** (a `Stop`-hook `systemMessage` fallback with no confirmed beneficiary — do not merge).
- **`anthropics/claude-code#44763`** (the native-timestamps feature request this plugin grew out of): still open. Prior ChronoClaude mentions were already triaged — **G-1049** (IDE-panel ANSI colour fix, done in #15/0.5.3) and **G-1051** (open: `MessageDisplay` from a plugin not firing in the VS Code panel on Windows — a Claude Code host bug, already documented in the README with a `settings.json` workaround).
- **G-1050** (open, Low): verify the visible marker renders in the JetBrains IDE terminal. Manual verification; our code already treats `cli`/unset entrypoints as ANSI-capable.
- **G-1182 / G-1183 / G-1184:** three identical auto-filed `@claude` intake tickets for the (merged) PR #22 — closed as duplicates during this review.
