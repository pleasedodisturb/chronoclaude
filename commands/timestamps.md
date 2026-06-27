---
description: Display timestamps for messages in the current conversation
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/parse-transcript.py:*)
argument-hint: [count]
model: haiku
---

## Context

- Current working directory: !`pwd`
- Arguments: $ARGUMENTS

## Task

Display a timestamped timeline of messages from the current conversation transcript.

### Step 1: Parse and display

Extract the count from `$ARGUMENTS`. If it is a positive integer, use it. Otherwise default to 20. Reject any non-numeric value — do not pass arbitrary strings to the script.

Run the parser, passing the current working directory (from the Context section above) via `--cwd` and the validated count. The script locates the right transcript by matching the working directory recorded *inside* Claude Code's transcript files — do **not** try to reconstruct the `~/.claude/projects/` path yourself (that breaks for paths containing dots, spaces, or other rewritten characters):

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/parse-transcript.py" --cwd "<cwd>" "<count>"
```

Replace `<cwd>` with the current working directory shown in the Context section, and `<count>` with the validated integer.

If the script prints "No transcript found …", relay that message to the user and stop.

### Step 2: Present output

Display the script output in a code block so columns align. Do not add commentary beyond the timeline.

### Constraints

- Never read the transcript with the Read tool — files can be very large.
- Only pass validated integers as the count argument.
- Pass the working directory exactly as shown in the Context section; do not invent project paths.
