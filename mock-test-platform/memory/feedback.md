# How to Work in This Project

## Memory Update Policy
Always update `memory/` files BEFORE any git commit or push.
Memory is the single source of truth for all architectural decisions.
If a decision was made in a session, it must be in memory before the push.

**Steps:**
1. Before git add/commit/push — check if decisions were made this session
2. If yes — update relevant files in `memory/` first
3. Only after memory is updated — proceed with git operations

## Response Style
- Terse, no trailing summaries
- No emoji unless user asks
- Reference files with line numbers when relevant

## Decision-Making Style
- Always push back on premature complexity
- "Stub now, activate on signal" — never add complexity before the signal
- If unsure between two approaches, recommend one clearly with reasoning
- Don't add features beyond what was asked

## Git
- Always create NEW commits, never amend published commits
- Stage specific files by name, not `git add -A`
- Check memory before commit — never push stale context

## No TypeScript
- Web FE uses HTMX + Tailwind CDN — no build step, no TypeScript
- Mobile uses React Native (JS only for consistency)
- Pure JS everywhere in FE — never introduce a build step to web layer

## Negative Marking Precision
- Use exact fraction `1/3` in config — never `0.33`
- Full float precision in all scoring calculations
- Only round at display: `score.toFixed(2)`
