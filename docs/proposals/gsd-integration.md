# Proposal: temporal context as a first-class signal for GSD

> **Revised 2026-04-28** in response to [@trek-e's review](https://github.com/gsd-build/get-shit-done/issues/2756#issuecomment-4323379458). Changes: tier-split the recommendation by cost/value, scale back the "value for agents" claims to what's deterministic today, narrow option 3 to what's actually additive over the existing `HANDOFF.timestamp` field.

## What this is

[`pleasedodisturb/claude-inject-idle-time`](https://github.com/pleasedodisturb/claude-inject-idle-time)
is a community Claude Code plugin that gives the model a sense of
wall-clock time and user-idle gaps — something Claude Code does not
expose natively today.

It works in three modes:

- **Passive** — hidden `[timing]` block (`time`, `idle_for`, `last_turn`) injected on every prompt via `UserPromptSubmit`. ~42 tokens/turn.
- **Active** — MCP server with `get_time`, `time_diff`, `mark_event`, `get_timeline` tools.
- **Retrospective** — `/timestamps [count]` slash command renders a wall-clock timeline from the session transcript.

It also ships a statusline fragment (live elapsed-since-last-reply) and a
TUI re-entry note (`[after 5m 2s]`).

This is a proposal to recommend it alongside [GSD](https://github.com/gsd-build/get-shit-done)
and discuss tighter integration. It is **not** a request to merge code into
GSD.

## Honest scope: what reaches whom today

Claude Code's `UserPromptSubmit` hook fires per-session. GSD spawns
subagents with fresh `session_id`s, so the passive `[timing]` block
reaches the **orchestrator session only** — execution, planner, verifier,
and reviewer subagents see nothing unless their parent injects timing
into their initial prompt (option 4 below, not currently wired).

This shapes the recommendation. The pieces split cleanly into "works
today, agent-independent" and "needs a skill or spawn-time bridge."

## Tiered recommendation

### Tier A — recommend unconditionally

Zero agent-prompt cost, immediately useful, no GSD code changes required.

- **Statusline fragment** — live elapsed-since-last-reply during long waves. Removes spinner-watching during 20-minute phase executions. Pure UI, no model exposure.
- **TUI re-entry note** (`[after 5m 2s]`) — visible to the human when they come back to a paused planning session.
- **Compaction-aware reset and model-change indicator (`---`)** — keeps the displayed elapsed time honest across GSD's frequent compactions and quality/balanced/budget profile flips.

These are user-facing, not agent-facing. They benefit any GSD user
whether or not GSD ships a skill bridge.

### Tier B — recommend if a skill bridge ships

Passive `[timing]` block (~42 tokens/turn on the orchestrator).

The block is non-deterministic value unless agents are taught to read
it. Without explicit instruction, the model may or may not act on
`idle_for`. That's not a basis for a recommendation. So Tier B is
gated on either:

- a small `agent_skills` entry teaching `gsd-discuss-phase`, `gsd-execute-phase`, `gsd-verify-work`, etc. to inspect `[timing]` and re-orient on large gaps (option 2 below), **or**
- spawn-time propagation so subagents inherit timing context (option 4 — needs design discussion).

Without one of these, Tier B is paying ~42 tokens/turn for behavior
that depends on the model noticing. Honest answer: don't recommend
it on that basis.

### Tier C — opt-in analytics

Retrospective `/timestamps [count]` is a separate audience entirely
(human reviewing a session after the fact). Independent install, zero
runtime cost. Worth a one-line mention in GSD docs but no integration
work.

### Tier D — opt-in for explicit event marking

Active MCP tools (`mark_event`, `get_timeline`, etc.) survive session
restarts because they're written to disk — making them more useful for
rate-limit/context-loss recovery than the passive block (which is
reconstructed fresh per session). Recommend only for users who want
explicit wave-cost telemetry; not part of the default ask.

## Answers to maintainer questions

**Q1 — "Are agents acting on `idle_for` spontaneously, or is there a planned skill update?"**

Spontaneously, today. That's non-deterministic and shouldn't be the
primary justification, agreed. The "value for agents" claims in the
prior revision overstated this. They've been moved into Tier B and
gated on a skill bridge. The skill bridge isn't written yet — if GSD
maintainers see the framing as worth pursuing, I'll draft an
`agent_skills` entry for `gsd-execute-phase` and `gsd-verify-work` as
a follow-up PR rather than asserting it as already-existing value.

**Q2 — "Is option 3 pre-computing the idle delta or adding raw fields? `now - HANDOFF.timestamp` is already derivable."**

Correct, and the prior revision conflated the two. `HANDOFF.timestamp`
plus a one-line resume-skill change covers the basic case (gap since
pause) with no plugin involvement. That's the right path for the
basic case.

What's actually additive in option 3, and only with the plugin:

- `last_turn_seconds` — wall-clock duration of the assistant's last reply (measurable from `Stop` timing, not from a single ISO timestamp).
- `idle_at_handoff` — the user's idle gap *before* pause was triggered, distinct from `now - timestamp` (gap *since* pause). Useful for distinguishing "user paused immediately after a reply" from "user idled for 30m, then paused."
- Last `mark_event` label — semantic checkpoint ("plan_3a_started") rather than a bare timestamp.

If those three fields aren't worth the dependency, option 3 collapses
to "GSD's resume skill already has what it needs from `HANDOFF.timestamp`"
and the plugin doesn't need to integrate here.

**Q3 — "Does compaction during a parallel wave produce misleading `idle_for` on still-active subagent sessions?"**

Verified by code inspection (`src/state.js`, `scripts/pre-compact.js`):
state files are keyed by `session_id`, and `PreCompact` only resets
the session that fired the hook. Compaction on the orchestrator
cannot corrupt subagent state files because they're separate files.

In practice this is moot today — subagents don't receive `[timing]`
at all (see Tier B framing). With option 4 (spawn-time propagation),
each subagent maintains its own `lastStopAt` and gets its own
`PreCompact` event, so the per-session reset is correct.

I have not run a live compaction-during-parallel-wave test on a real
GSD project. If maintainers want one before any recommendation lands,
I'll add a `gsd-execute-phase`-shaped scenario to the plugin's
integration tests.

## What we combined

| Source | What we took |
| --- | --- |
| [`clankercode/claude-inject-idle-time`](https://github.com/clankercode/claude-inject-idle-time) | The passive `[timing]` block injected via `UserPromptSubmit`, the `Stop` and `PreCompact` hooks, and the statusline fragment with model-change handling. |
| [`s-a-s-k-i-a/claude-code-timestamps`](https://github.com/s-a-s-k-i-a/claude-code-timestamps) (MIT) | The retrospective `/timestamps` slash command — reads `.jsonl` session transcripts and renders a wall-clock timeline. |

On top of those, [clankercode/claude-inject-idle-time#1](https://github.com/clankercode/claude-inject-idle-time/pull/1)
adds the **active** mode: an MCP server exposing `get_time`, `time_diff`,
`mark_event`, and `get_timeline`, plus automatic session-timeline logging via
a `PostToolUse` hook.

## Integration options (low → high effort)

1. **Doc-only, Tier A.** One-line mention recommending the statusline + TUI re-entry pieces. Zero agent-prompt cost, zero GSD code changes.
2. **Skill-bridge.** `agent_skills` entry teaching key GSD subagents to read `[timing]` and (optionally) call MCP tools. Required for Tier B value to be deterministic. Happy to draft if direction is welcome.
3. **HANDOFF.json fields — narrowed.** *Only the additive fields:* `last_turn_seconds`, `idle_at_handoff`, last `mark_event`. The basic "time since pause" case is already covered by `HANDOFF.timestamp` + a resume-skill one-liner — no plugin needed.
4. **Spawn-time propagation.** Parent injects last-known timing into the child's initial prompt. Closes the subagent gap. Needs design discussion; not in the minimum ask.

## Open questions

- **Tier A worth a doc mention?** This is the smallest, safest ask — pure UI, opt-in install. If yes, the rest can be deferred.
- **Skill-bridge appetite.** If GSD maintainers would consider a skill PR, I'll draft one targeting `gsd-execute-phase` + `gsd-verify-work` first (highest-leverage entry points).
- **`gsd-prompt-guard` interaction.** `[timing]…[/timing]` envelope is structured/predictable; should be safelisted as trusted metadata if Tier B ever lands.
- **Privacy.** Timing reveals activity patterns. Opt-in install; flag in docs if recommended.

## Related prior work in this repo

Adjacent threads — covered for completeness, not duplicates. They address
*continuity / handoff state*; this proposal is about *temporal signal*.

- Discussion [#2178](https://github.com/gsd-build/get-shit-done/discussions/2178) — *How to best resume work after token exhaustion.* Tier D (active mode, disk-persisted) is the most relevant piece — survives the session death that breaks the passive block.
- Discussion [#1961](https://github.com/gsd-build/get-shit-done/discussions/1961) — *Resumable research with checkpointing.* Pairs naturally with `mark_event` / `get_timeline`.
- Discussion [#535](https://github.com/gsd-build/get-shit-done/discussions/535) — *Coming back after a milestone is done.* Same gap on a longer horizon.
- Issue [#2473](https://github.com/gsd-build/get-shit-done/issues/2473) — *`/gsd-ship` should refuse to open a PR when HANDOFF.json declares in-progress work.* Reinforces HANDOFF.json as a load-bearing surface.
- Issue [#2006](https://github.com/gsd-build/get-shit-done/issues/2006) — *Planner agent loses critical detail at handoff boundaries.* Different lossage (semantic, not temporal), but adjacent.

Not a duplicate of [#2410](https://github.com/gsd-build/get-shit-done/issues/2410) — `Stream idle timeout` is a Claude Code stream-level timeout, unrelated to model-side idle awareness.

## Links

### Repos

- Combined plugin (this proposal): <https://github.com/pleasedodisturb/claude-inject-idle-time>
- Source — passive injection: <https://github.com/clankercode/claude-inject-idle-time>
- Source — retrospective transcript parsing (MIT): <https://github.com/s-a-s-k-i-a/claude-code-timestamps>
- GSD: <https://github.com/gsd-build/get-shit-done>

### Code proposal

- Active + retrospective modes: <https://github.com/clankercode/claude-inject-idle-time/pull/1>

### Anthropic issues this addresses

- [anthropics/claude-code#44763](https://github.com/anthropics/claude-code/issues/44763) — Add timestamps to conversation messages.
- [anthropics/claude-code#47160](https://github.com/anthropics/claude-code/issues/47160) — Expose message timestamps to the model.

### Adjacent GSD threads

- Discussions: [#2178](https://github.com/gsd-build/get-shit-done/discussions/2178), [#1961](https://github.com/gsd-build/get-shit-done/discussions/1961), [#535](https://github.com/gsd-build/get-shit-done/discussions/535)
- Issues: [#2473](https://github.com/gsd-build/get-shit-done/issues/2473), [#2006](https://github.com/gsd-build/get-shit-done/issues/2006)
