# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.2] - 2026-06-12

### Changed
- **De-branded leftover `idle-timing` identifiers** missed by the v0.5.0 rename: the MCP server now self-identifies as `chronoclaude-time-server` (was `idle-timing-time-server`), the `/chronoclaude-setup` and `/chronoclaude-config` command docs and their paste-ready snippets now say chronoclaude (including the snippet marker comments and example paths), `parse-transcript.py`'s docstring, and test tmpdir prefixes. No functional changes; the `.mcp.json` server key and `CLAUDE_TIMING_*` env vars are unchanged. If you wired the statusline snippet with the old `# --- idle-timing fragment ---` markers, it keeps working — the markers are comments.

## [0.5.1] - 2026-06-12

### Changed
- **Relicensed from Unlicense/CC0 to MIT.** The plugin's own code is now under the MIT License, matching the two MIT upstreams already credited in `THIRD-PARTY-LICENSES.md`. The original clankercode base was public domain (Unlicense / CC0 1.0), which permits the relicense; a provenance note was added to `THIRD-PARTY-LICENSES.md`. License metadata updated in `plugin.json`, `marketplace.json`, and `package.json`.

## [0.5.0] - 2026-06-05

### Changed
- **Renamed to ChronoClaude.** The plugin outgrew "idle timing" — it now covers visible per-message timestamps, hidden timing context, an MCP time server, a session timeline, and a statusline clock. Identity changes:
  - Repo `claude-inject-idle-time` → `chronoclaude` (old URLs redirect).
  - Plugin name `idle-timing` → `chronoclaude`; marketplace `idle-info` → `chronoclaude`; owner → `pleasedodisturb`. Install is now `/plugin marketplace add pleasedodisturb/chronoclaude` then `/plugin install chronoclaude@chronoclaude`.
  - Slash commands `/idle-time-setup` → `/chronoclaude-setup`, `/idle-time-config` → `/chronoclaude-config` (`/timestamps` unchanged).
  - Plugin data dir `idle-timing-idle-info` → `chronoclaude-chronoclaude`. **Existing session/timeline data is not migrated** (it's ephemeral); a fresh dir is used. Re-add the marketplace after upgrading.
- **Unchanged on purpose:** the `CLAUDE_TIMING_*` env toggles keep their names so existing `settings.json` configs keep working. Upstream credits (clankercode / s-a-s-k-i-a / zoharbabin) are retained in the README and `THIRD-PARTY-LICENSES.md`.

## [0.4.1] - 2026-06-05

### Added
- **Coloured message timestamp** — the visible `[HH:MM:SS]` marker is now rendered in grey by default (`\x1b[90m`), so it stays subtle against the assistant's text. Configurable via `CLAUDE_TIMING_MESSAGE_DISPLAY_COLOR` (named colour like `grey`/`cyan`/`dim`, a raw SGR sequence like `1;90`, or `none` to disable colour). Only the marker is coloured — the message text is never recoloured.
- **Statusline clock** — `scripts/statusline-fragment.js` accepts `--clock` to print the current local time (`HH:MM`), combinable with the elapsed timer and positioned via `--clock-position before|after` (default `before`). The clock renders even when no session/elapsed is available, so the plugin can own the statusline clock you'd otherwise hand-roll with `date`.

## [0.4.0] - 2026-06-03

### Added
- **Visible per-message timestamp** — a new `MessageDisplay` hook (`scripts/message-display.js`) prepends a local-time `[HH:MM:SS]` marker to each assistant message on screen. Display-only: it never alters the transcript or what Claude sees. Requires Claude Code 2.1.152+ (older versions simply never fire the hook). Adapted from `zoharbabin/claude-code-message-timestamps` (MIT) — see `THIRD-PARTY-LICENSES.md`.
- **Per-surface toggles** — `src/config.js` adds `CLAUDE_TIMING_PASSIVE`, `CLAUDE_TIMING_IDLE_NOTE`, `CLAUDE_TIMING_MESSAGE_DISPLAY`, and `CLAUDE_TIMING_TIMELINE`. Each surface is on by default and disabled only by an explicit falsy value (`0`/`false`/`off`/`no`). Hooks stay fail-soft.
- **`/idle-time-config` slash command** — reports each surface's effective on/off state and prints a paste-ready `settings.json` snippet to toggle them.

### Changed
- **Unified timeline** — the MCP `get_timeline` tool now merges the in-memory marked events (`mark_event`) with the auto-logged PostToolUse disk timeline, in chronological order with inter-event durations. The auto-logged tool history was previously a write-only dead-end that no tool could read. `get_timeline` accepts an optional `session_id` (defaults to the most recent session). Output entries now carry a `kind` (`mark` | `tool`) field.

## [0.3.1] - 2026-05-03

### Fixed
- Hooks no longer block the user's prompt on internal failure. `UserPromptSubmit`, `Stop`, `PreCompact`, and `PostToolUse` now exit 0 (fail-soft) on missing env vars, malformed stdin, disk errors, etc. — they still log to stderr for diagnosis but never propagate failure to Claude Code.
- `loadSessionState` recovers from a corrupt state file (truncated/malformed JSON). The bad file is renamed to `.json.corrupt` for forensics and a fresh state is returned, so a single mid-write crash no longer breaks every subsequent prompt forever.
- `formatTimingBlock` no longer accepts a dead `idleSinceLastAssistantMs` argument from `user-prompt-submit.js`. The field was passed but never used; cleanup only.

## [0.3.0] - 2026-04-17

### Changed
- Timing block is now a multiline `[timing]` tag with `key=value` fields on their own lines, cutting token usage by ~25% (40t vs 53t on a typical block, via `gpt-tokenizer`).
- Timestamp renders in local time with an explicit UTC offset (e.g. `2026-04-17T16:04:19+10:00`) instead of UTC `Z`, and milliseconds are dropped from the displayed value (state still keeps ms precision).
- Field renames: `user_message_utc` → `time`, `idle_since_last_stop_seconds` → `idle_for` (with `s` suffix on the value), `last_turn_exec_seconds` → `last_turn`.
- Idle system message now appears after 10 seconds of idle time (was 60 seconds), providing faster visibility into resumed conversations.

### Added
- `bun run tokens` / `npm run tokens` script (`scripts/token-benchmark.js`) that prints token counts for representative timing payloads using `gpt-tokenizer`.

## [0.2.0] - 2026-04-17

### Added
- `scripts/statusline-fragment.js` — composable statusline fragment printing elapsed time since the model's last reply (`45s`, `3m 21s`, `17m`, `1h 23m`).
- `/idle-time-setup` slash command prints a paste-ready snippet and settings change to wire the fragment into an existing statusline.
- `PreCompact` hook resets the idle timer on context compaction, so the fragment counts from the compaction event rather than the pre-compact final reply.
- Fragment tracks the active model and prints `---` when the current model differs from the one that produced the last reply (e.g. after `/model`), resuming the elapsed count if the user switches back.
- Fragment accepts `--model-id <id>` flag and reads `model.id` from stdin statusline JSON.

## [0.1.3] - 2026-04-17

### Added
- Dual Unlicense/CC0 license
- Full plugin.json metadata (author, homepage, repository, license, keywords)
- Marketplace packaging as `idle-info` (was `idle-timing-local`)
- Marketplace install instructions in README
- RELEASING.md with release checklist and version-match pre-release check

## [0.1.2] - 2026-04-16

### Added
- Visible `[after Xm Ys]` system message when idle exceeds 60 seconds

## [0.1.1] - 2026-04-15

### Added
- `Stop` hook persists per-session timing state (last stop timestamp, exec duration)
- `UserPromptSubmit` hook injects hidden `[message_timing]` block with structured fields:
  - `user_message_utc` — ISO 8601 UTC timestamp
  - `idle_since_last_stop_seconds` — seconds since last `Stop` hook fired
  - `last_turn_exec_seconds` — duration of the previous turn
- Atomic state writes via temp-file rename (safe on Linux/macOS)
- Session ID sanitization to prevent path traversal
- Test-injectable clock via `CLAUDE_TIMING_NOW_ISO` env var
- 28 automated tests covering unit, integration, and installability checks
