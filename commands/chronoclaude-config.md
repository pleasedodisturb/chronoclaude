---
description: Show which chronoclaude surfaces are on/off and a paste-ready snippet to toggle them
allowed-tools: [Read, Bash]
---

# ChronoClaude surface configuration

Goal: report the effective on/off state of each chronoclaude surface and give the user a paste-ready `settings.json` snippet to toggle any of them. **Do not modify any files** — this command prints information only.

Surfaces and their environment variables (each defaults to **on**; a surface is off only when its variable is set to `0`, `false`, `off`, or `no`, case-insensitive):

| Surface | What it does | Visible? | Env var |
|---|---|---|---|
| Passive timing block | Hidden `[timing]` block (local time, idle gap, last-turn duration) injected each prompt | hidden (Claude only) | `CLAUDE_TIMING_PASSIVE` |
| Idle note | Visible `[after 5m 2s]` message when you return after >10s idle (terminal TUI; the VS Code panel does not render hook `systemMessage`) | visible (on idle) | `CLAUDE_TIMING_IDLE_NOTE` |
| Message timestamp | Visible `[HH:MM:SS]` prefix on every assistant message (needs Claude Code 2.1.152+; colour auto-suppressed to plain in the VS Code panel, where raw ANSI would leak as `[90m…[0m`) | visible (always) | `CLAUDE_TIMING_MESSAGE_DISPLAY` |
| Tool timeline | Auto-logs tool calls to a per-session JSONL the MCP `get_timeline` tool can read | hidden (disk) | `CLAUDE_TIMING_TIMELINE` |

Steps:

1. Read the `env` block of `~/.claude/settings.json` (also check `settings.local.json`, and the project-scoped `.claude/settings.json` in the working directory). For each of the four variables, determine the effective state: **on** unless explicitly set to a falsy value (`0`/`false`/`off`/`no`). You may also run `printenv` for the four variables to see what is currently exported into the session.

2. Print a short table of each surface's current effective state (on/off) and where the setting came from (settings file, exported env, or default).

3. Print a paste-ready snippet to toggle. To **disable** a surface, add its variable set to `"0"` in the `env` block; to **re-enable**, set `"1"` or remove the line. Example (disabling the visible message timestamp, leaving the rest on):

    ```json
    {
      "env": {
        "CLAUDE_TIMING_MESSAGE_DISPLAY": "0"
      }
    }
    ```

4. Note that env-var toggles are read by the hook scripts at invocation time, so changes take effect on the next session start (or after the env is re-exported). Suggest `/reload-plugins` after editing scripts, but for env changes a new session is the reliable path.

5. Close with a one-line reminder that all surfaces are independent — e.g. you can keep the visible `[HH:MM:SS]` on while turning the hidden passive block off, or vice-versa.
