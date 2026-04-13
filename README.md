# Claude Code Idle Timing Plugin

Claude Code plugin that injects hidden timing context alongside each user message.

The plugin adds:

- `user_message_utc`
- `idle_since_last_stop_seconds`
- `last_turn_exec_seconds`

## What It Does

The plugin uses official Claude Code hooks:

- `UserPromptSubmit` injects hidden timing context on every prompt
- `UserPromptSubmit` also shows a compact TUI note like `[after 5m 2s]` when the user replies after more than one idle minute
- `Stop` persists per-session timing state for the next turn

On a fresh session, unavailable prior-turn fields are omitted.

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
