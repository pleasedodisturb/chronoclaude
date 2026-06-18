---
description: Show which chronoclaude surfaces are on/off and a paste-ready snippet to toggle them
allowed-tools: [Read, Bash]
---

# ChronoClaude surface configuration

Goal: report the effective on/off state of each chronoclaude surface and give the user a paste-ready `settings.json` snippet to toggle any of them. **Do not modify any files** — this command prints information only.

Most surfaces default to **on** (off only when their variable is set to `0`, `false`, `off`, or `no`, case-insensitive). The **opt-in** surface marked below is the inverse — off by default, on only for a truthy value (`1`/`true`/`on`/`yes`):

| Surface | What it does | Visible? | Env var | Default |
|---|---|---|---|---|
| Passive timing block | Hidden `[timing]` block (local time, idle gap, last-turn duration) injected each prompt | hidden (Claude only) | `CLAUDE_TIMING_PASSIVE` | on |
| Idle note | Visible `[after 5m 2s]` message when you return after >10s idle | visible (on idle) | `CLAUDE_TIMING_IDLE_NOTE` | on |
| Message timestamp | Visible `[HH:MM:SS]` prefix on every assistant message (needs Claude Code 2.1.152+; **terminal TUI only** — the `MessageDisplay` hook does not fire in the VS Code / JetBrains extension panels) | visible (always) | `CLAUDE_TIMING_MESSAGE_DISPLAY` | on |
| Per-turn timestamp note | Visible `[HH:MM:SS]` system note after each reply via the `Stop` hook — the **IDE-extension workaround** for the message timestamp above; off by default so terminal users aren't double-stamped | visible (per turn) | `CLAUDE_TIMING_STOP_TIMESTAMP` | **off (opt-in)** |
| Tool timeline | Auto-logs tool calls to a per-session JSONL the MCP `get_timeline` tool can read | hidden (disk) | `CLAUDE_TIMING_TIMELINE` | on |

Steps:

1. Read the `env` block of `~/.claude/settings.json` (also check `settings.local.json`, and the project-scoped `.claude/settings.json` in the working directory). For each variable, determine the effective state. For the default-**on** surfaces: **on** unless explicitly set to a falsy value (`0`/`false`/`off`/`no`). For the opt-in `CLAUDE_TIMING_STOP_TIMESTAMP`: **off** unless explicitly set to a truthy value (`1`/`true`/`on`/`yes`). You may also run `printenv` for the variables to see what is currently exported into the session.

2. Print a short table of each surface's current effective state (on/off) and where the setting came from (settings file, exported env, or default).

3. Print a paste-ready snippet to toggle. For the default-on surfaces, **disable** by setting the variable to `"0"` and **re-enable** by setting `"1"` or removing the line. For the opt-in `CLAUDE_TIMING_STOP_TIMESTAMP`, it's reversed: **enable** by setting `"1"` (the IDE-panel workaround) and **disable** by removing the line or setting `"0"`. Example (disabling the visible message timestamp, leaving the rest on):

    ```json
    {
      "env": {
        "CLAUDE_TIMING_MESSAGE_DISPLAY": "0"
      }
    }
    ```

4. Note that env-var toggles are read by the hook scripts at invocation time, so changes take effect on the next session start (or after the env is re-exported). Suggest `/reload-plugins` after editing scripts, but for env changes a new session is the reliable path.

5. Close with a one-line reminder that all surfaces are independent — e.g. you can keep the visible `[HH:MM:SS]` on while turning the hidden passive block off, or vice-versa.
