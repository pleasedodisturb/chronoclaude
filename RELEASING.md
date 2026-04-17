# Releasing

## Pre-release checklist

Run this before tagging:

```bash
npm run prerelease
```

This runs `check:version` (verifies `plugin.json` and `package.json` have the same version) then the full test suite.

### Manual checklist

- [ ] `plugin.json` and `package.json` versions match (enforced by `npm run check:version`)
- [ ] `marketplace.json` plugin entry version matches
- [ ] `CHANGELOG.md` has an entry for the new version with today's date
- [ ] `claude plugin validate .` passes
- [ ] `npm test` passes (28 tests)
- [ ] All changes committed and pushed

## Bumping the version

Edit the version in all three places atomically:

1. `.claude-plugin/plugin.json` — `version`
2. `package.json` — `version`
3. `.claude-plugin/marketplace.json` — `plugins[0].version`
4. `CHANGELOG.md` — move `[Unreleased]` section to the new version + date

## Tagging a release

```bash
npm run prerelease           # final gate check
git tag v<version>
git push origin v<version>
```

Example for v1.0.0:

```bash
npm run prerelease
git tag v1.0.0
git push origin v1.0.0
```

## Marketplace install command (for release notes / issue comments)

```text
/plugin marketplace add clankercode/claude-inject-idle-time
/plugin install idle-timing@idle-info
```

## Distribution targets

After tagging, submit or update listings at:

- **Self-hosted (already live):** `clankercode/claude-inject-idle-time` — no action needed after push
- **Community aggregators (open PRs):**
  - `ananddtyagi/cc-marketplace` — add/update entry in `.claude-plugin/marketplace.json`
  - `xiaolai/claude-plugin-marketplace` — add/update entry
  - `ComposioHQ/awesome-claude-plugins` — add/update README table row
  - `hesreallyhim/awesome-claude-code` — add/update README table row
- **Official Anthropic marketplace:** https://claude.ai/settings/plugins/submit
- **Anthropic issues:** comment with install command on:
  - https://github.com/anthropics/claude-code/issues/47160
  - https://github.com/anthropics/claude-code/issues/44763
