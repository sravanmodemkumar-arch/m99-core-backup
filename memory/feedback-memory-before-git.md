---
name: Update memory before every git push
description: Always update local memory files before running any git push — non-negotiable rule
type: feedback
---

Always update all relevant memory files in `/memory/` BEFORE running any git push or git commit.

**Why:** Memory files are the single source of truth for all architectural decisions, rules, and project context. Stale memory = wrong context in future sessions = decisions that contradict agreed architecture.

**How to apply:**
1. Before any `git add` / `git commit` / `git push` — check if any decisions were made in the session
2. If yes — update or create relevant memory files in `/home/sravan/Desktop/projects/memory/` first
3. Only after memory is updated — proceed with git operations
4. Applies even for small pushes — if a decision was discussed, it must be in memory first

**Memory location:** `/home/sravan/Desktop/projects/memory/` (local only, not global Claude memory)
