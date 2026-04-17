---
description: Show paste-ready snippet to wire the idle-timing fragment into your existing statusline
allowed-tools: [Read, Bash]
---

# Idle-time statusline setup

Goal: help the user add the `statusline-fragment` to their existing statusline script and enable periodic refresh.

Steps:

1. Locate the user's current statusline configuration. Read `~/.claude/settings.json` (may not exist; may be named `settings.local.json`; project-scoped settings may be at `.claude/settings.json` in the working directory). Extract the `statusLine.command` string and any existing `statusLine.refreshInterval` value.

2. If a `statusLine.command` is set, read the script it points to (handle leading `bash `, `sh `, env substitutions like `${HOME}` or `$HOME`, and `~`). Confirm it reads stdin once into a variable (look for `$(cat)` or an equivalent) — the snippet assumes that.

3. Print a short summary:
    - The path of the statusline script being patched
    - Whether `refreshInterval` is already set and its current value
    - The plugin root path: note that `$CLAUDE_PLUGIN_ROOT` is set when the script runs as a hook, but the statusline script runs outside hook context — use the hardcoded installed path instead.

4. Print the paste-ready snippet the user can drop into their statusline script. If the script already assigns stdin to a variable named `input`, use that name; otherwise suggest renaming. Place the snippet just before the final output assembly. Example snippet:

    ```bash
    # --- idle-timing fragment ---
    session_id=$(echo "$input" | jq -r '.session_id // empty')
    if [ -n "$session_id" ]; then
      idle=$(node "/path/to/idle-timing/scripts/statusline-fragment.js" \
        --session-id "$session_id" 2>/dev/null || true)
      [ -n "$idle" ] && parts+=("$idle")
    fi
    # --- /idle-timing fragment ---
    ```

    Substitute the actual installed plugin path (e.g. `/home/<user>/src/claude-inject-idle-time` for local installs, or the path under `~/.claude/plugins/` for marketplace installs).

    If the script does not use a `parts` bash array, show a variant that appends directly to the output string instead:

    ```bash
    # --- idle-timing fragment ---
    session_id=$(echo "$input" | jq -r '.session_id // empty')
    if [ -n "$session_id" ]; then
      idle=$(node "/path/to/idle-timing/scripts/statusline-fragment.js" \
        --session-id "$session_id" 2>/dev/null || true)
      [ -n "$idle" ] && result="$result | $idle"
    fi
    # --- /idle-timing fragment ---
    ```

5. Print the settings change to enable periodic refresh:

    ```json
    {
      "statusLine": {
        "command": "<existing command>",
        "refreshInterval": 1
      }
    }
    ```

    Tell the user to add `"refreshInterval": 1` (seconds) to their `statusLine` object in `~/.claude/settings.json`. Note that without it, the fragment still updates on every event (new message, tool result) but will not tick while idle.

6. Do NOT modify any files. This command prints instructions only.

7. Close with a one-line test hint: start a new Claude Code session, wait a few seconds after Claude replies, and you should see the elapsed time appear in the statusline and tick once per second.
