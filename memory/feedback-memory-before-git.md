---
name: Update memory before every git push
description: Always update local memory files before running any git push — non-negotiable rule
type: feedback
---

Update memory files ONLY immediately before a git push — not mid-task, not after every decision.

**Why:** Mid-task memory updates are wasteful and interrupt flow. The right trigger is: "about to push" → update memory → then push. This was corrected explicitly.

**How to apply:**
1. Work through the full task normally — do NOT update memory during the work
2. Only when `git push` is imminent — check what decisions/patterns were established this session
3. Update or create relevant memory files in `/home/sravan/Desktop/projects/memory/` at that point
4. Then commit + push. Memory update counts as part of the push checklist.

**What NOT to do:** Update memory in the middle of a session unprompted, or every time a file is created.

**Memory location:** `/home/sravan/Desktop/projects/memory/` (local project memory only — never global Claude memory at ~/.claude/)
