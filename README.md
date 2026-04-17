# Claude Code Idle Timing Plugin

Claude Code plugin that injects hidden timing context alongside each user message.

![Idle note on re-entry plus a live statusline timer tracking elapsed time since Claude's last reply](docs/screenshots/hero.png)

The plugin adds:

- `user_message_utc`
- `idle_since_last_stop_seconds`
- `last_turn_exec_seconds`

Each prompt gets a hidden block Claude reads but you never see in your transcript:

```
[message_timing]
user_message_utc: 2026-04-17T05:07:18.228Z
idle_since_last_stop_seconds: 17.0
last_turn_exec_seconds: 3.7
[/message_timing]
```

## What It Does

The plugin uses official Claude Code hooks:

- `UserPromptSubmit` injects hidden timing context on every prompt
- `UserPromptSubmit` also shows a compact TUI note like `[after 5m 2s]` when the user replies after more than one idle minute
- `Stop` persists per-session timing state for the next turn
- `PreCompact` resets the idle timer when context compaction runs, so the statusline counts from the compaction event rather than the last pre-compact reply

On a fresh session, unavailable prior-turn fields are omitted.

## Install via Marketplace

```text
/plugin marketplace add clankercode/claude-inject-idle-time
/plugin install idle-timing@idle-info
```

## Statusline integration (optional)

This plugin ships a composable fragment that prints the elapsed time since the model's last reply. It is meant to be dropped into your existing statusline script, not to replace one.

Run the slash command for a guided paste-ready snippet tailored to your current statusline:

```text
/idle-time-setup
```

At a minimum you will need to:

1. Enable periodic refresh in `~/.claude/settings.json`:

    ```json
    { "statusLine": { "refreshInterval": 1 } }
    ```

2. In your statusline script, after you read stdin into a variable (e.g. `input=$(cat)`), pipe the full stdin JSON to the fragment so it can see the current `session_id` and `model.id`:

    ```bash
    idle=$(echo "$input" | node "/path/to/idle-timing/scripts/statusline-fragment.js" 2>/dev/null || true)
    [ -n "$idle" ] && parts+=("$idle")
    ```

The fragment prints just the elapsed time (e.g. `45s`, `3m 21s`, `17m`, `1h 23m`). Add any prefix or emoji in your own script.

If the current model no longer matches the one that produced the last reply (e.g. you switched with `/model`), the fragment prints `---` instead — the elapsed time is no longer meaningful. The original model's timer resumes if you switch back.

Flags:

- `--session-id <id>` — explicit session id; overrides stdin.
- `--model-id <id>` — explicit model id; overrides stdin.
- `--drop-seconds-after <seconds>` — switch to minute-only formatting at this threshold (default `900`, i.e. 15 minutes).

## Local Usage

Run Claude Code with the plugin from this repo root:

```bash
claude --plugin-dir .
```

If Claude Code is already running, reload plugins after changes:

```text
/reload-plugins
```

## Validation

Run the automated test suite:

```bash
npm test
```

Validate the plugin structure:

```bash
claude plugin validate .
```

## Notes

- The timing block is added as hidden hook context, not visible prompt text.
- The over-one-minute idle note is emitted as a hook `systemMessage` so it is visible to the user without being added to the plugin's `additionalContext`.
- In v1, idle time is measured from the previous `Stop` hook timestamp.
