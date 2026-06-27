#!/usr/bin/env python3
"""Parse a Claude Code transcript JSONL file and display a timestamped message timeline.

Based on s-a-s-k-i-a/claude-code-timestamps (MIT), adapted for the chronoclaude plugin.
"""

import json
import os
import sys
from datetime import datetime, timezone


def validate_transcript_path(path):
    """Validate that the path points to a real file inside ~/.claude/projects/."""
    resolved = os.path.realpath(path)
    claude_dir = os.path.realpath(os.path.expanduser("~/.claude/projects"))
    if not resolved.startswith(claude_dir + os.sep):
        sys.exit("Error: transcript path must be inside ~/.claude/projects/")
    if not resolved.endswith(".jsonl"):
        sys.exit("Error: transcript file must be a .jsonl file")
    if not os.path.isfile(resolved):
        sys.exit("Error: transcript file not found")
    return resolved


def transcript_cwd(path):
    """Return the working directory recorded inside a transcript, or None.

    Claude Code stamps the originating `cwd` onto (nearly) every transcript
    entry. We return the first one we find. Matching this recorded directory is
    robust against the path rewriting Claude Code applies when deriving the
    ~/.claude/projects/<dir> name (which mangles dots, spaces, and other
    characters) — reconstructing that name by hand is not.
    """
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                if '"cwd"' not in line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                cwd = entry.get("cwd")
                if isinstance(cwd, str) and cwd:
                    return cwd
    except OSError:
        return None
    return None


def find_transcript_for_cwd(target_cwd):
    """Find the most recent transcript whose recorded cwd matches target_cwd.

    Approach adapted from s-a-s-k-i-a/claude-code-timestamps: match the working
    directory stored *inside* the transcript instead of guessing the project
    folder name from the path.
    """
    projects_dir = os.path.realpath(os.path.expanduser("~/.claude/projects"))
    if not os.path.isdir(projects_dir):
        return None

    target = os.path.normpath(os.path.expanduser(target_cwd))

    candidates = []
    for root, _dirs, files in os.walk(projects_dir):
        for name in files:
            if not name.endswith(".jsonl"):
                continue
            file_path = os.path.join(root, name)
            try:
                mtime = os.path.getmtime(file_path)
            except OSError:
                continue
            candidates.append((mtime, file_path))

    for _mtime, file_path in sorted(candidates, reverse=True):
        recorded = transcript_cwd(file_path)
        if recorded and os.path.normpath(recorded) == target:
            return file_path

    return None


def extract_preview(entry):
    """Extract a short text preview from a message entry."""
    msg = entry.get("message", {})
    content = msg.get("content", [])

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text":
                return block.get("text", "")
            if block.get("type") == "tool_use":
                return f"[tool: {block.get('name', '?')}]"

    return ""


def truncate(text, max_len=80):
    """Truncate text to max_len, collapsing whitespace."""
    text = " ".join(text.split()).strip()
    if len(text) > max_len:
        return text[: max_len - 3] + "..."
    return text if text else "(no text content)"


def format_timestamp(ts_raw, today):
    """Format an ISO timestamp as HH:MM (same day) or YYYY-MM-DD HH:MM (older)."""
    try:
        dt = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
        local_dt = dt.astimezone()
        if local_dt.date() == today:
            return local_dt.strftime("%H:%M")
        return local_dt.strftime("%Y-%m-%d %H:%M")
    except (ValueError, AttributeError, TypeError):
        return "??:??"


def parse_messages(transcript_path):
    """Read the JSONL and yield (timestamp_raw, role, preview) tuples."""
    with open(transcript_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("type") not in ("user", "assistant"):
                continue
            preview = truncate(extract_preview(entry))
            if preview == "(no text content)":
                continue
            yield (
                entry.get("timestamp", ""),
                entry.get("type", ""),
                preview,
            )


def parse_count(value, default=20):
    """Return a positive integer count, or the default for anything else."""
    if value is not None and value.isdigit() and int(value) > 0:
        return int(value)
    return default


def main():
    args = sys.argv[1:]
    cwd = None
    positional = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--cwd":
            i += 1
            if i >= len(args):
                sys.exit("Error: --cwd requires a directory argument")
            cwd = args[i]
        elif arg.startswith("--cwd="):
            cwd = arg[len("--cwd="):]
        else:
            positional.append(arg)
        i += 1

    if cwd is not None:
        count = parse_count(positional[0] if positional else None)
        transcript_path = find_transcript_for_cwd(cwd)
        if not transcript_path:
            sys.exit(
                "No transcript found for this project directory. This command "
                "must be run from a directory with an active Claude Code session."
            )
        transcript_path = validate_transcript_path(transcript_path)
    else:
        if not positional:
            sys.exit(
                "Usage: parse-transcript.py (<transcript_path> | --cwd <dir>) [count]"
            )
        transcript_path = validate_transcript_path(positional[0])
        count = parse_count(positional[1] if len(positional) >= 2 else None)

    messages = list(parse_messages(transcript_path))
    tail = messages[-count:]

    today = datetime.now(timezone.utc).astimezone().date()

    print()
    print("--- Message Timeline ---")
    print()
    for ts_raw, role, preview in tail:
        ts = format_timestamp(ts_raw, today)
        label = "You" if role == "user" else "Claude"
        print(f"{ts}  {label:<6}  {preview}")
    print()
    print(f"Showing {len(tail)} of {len(messages)} messages.")
    if len(messages) > count:
        print("Tip: use /timestamps <number> to show more messages.")


if __name__ == "__main__":
    main()
