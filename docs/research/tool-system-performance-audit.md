# Tool System Performance Audit: Recent Changes (Feb 26 - Mar 26, 2026)

## Executive Summary

This audit examines recent changes to the tool system, system prompts, and agent
definitions that could cause performance regressions in long-running sessions by
increasing token count per LLM request. The investigation covers commits from
the last 4 weeks across tool definitions, tool descriptions, system prompt
generation, and the agent/permission system.

**Key findings:**

1. A new `codebase_search` tool was added (PR #6685), adding ~974 bytes to tool definitions when enabled via experimental flag.
2. The `environment_details` system was introduced (PR #6225), injecting per-message dynamic context into user messages — a net token increase but only on the last user message.
3. Config location awareness was added to the system prompt (PR #7444), adding ~2 lines to every `<env>` block.
4. `PlanExitTool` is now always registered in the tool registry instead of being feature-flag-gated, adding its description (~614 bytes) to every session.
5. A session diff memory leak (PR #7617) was identified and fixed, which caused multi-GB `before`/`after` strings to accumulate in session storage for long sessions.

---

## Change 1: New `codebase_search` Tool (WarpGrep)

**PR:** #6685  
**Commit:** `cd26320f6` (Mar 17, 2026)  
**Author:** DhruvBhatia0  
**Merged via:** upstream merge v1.2.21

### What changed

- New tool `codebase_search` (file: `packages/opencode/src/tool/warpgrep.ts`) — an AI-powered multi-step codebase search via Morph SDK.
- New tool description file: `packages/opencode/src/tool/warpgrep.txt` (974 bytes / ~10 lines)
- Registered in `packages/opencode/src/tool/registry.ts:119` behind experimental flag:
  ```ts
  ...(config.experimental?.codebase_search === true ? [CodebaseSearchTool] : [])
  ```
- Agent permissions added for `codebase_search` in `code`, `debug`, and `explore` agents (`packages/opencode/src/agent/agent.ts`)
- Explore agent prompt conditionally prepended when flag is on:
  ```ts
  prompt: cfg.experimental?.codebase_search
    ? `Prefer using the codebase_search tool for codebase searches — ...`
    : PROMPT_EXPLORE
  ```

### Token impact

- **When experimental flag is OFF (default):** No impact. Tool is not registered.
- **When experimental flag is ON:** +974 bytes (~250 tokens) for the tool description, plus JSON schema for its `query` parameter (~100 tokens), plus ~150 chars added to the explore agent prompt.

### Risk assessment: LOW (gated behind experimental flag)

---

## Change 2: `environment_details` Injection into User Messages

**PR:** #6225  
**Branch:** `mark/move-dynamic-context-to-user-message`  
**Commits:** `f6da5ded8` through `aee00686d` (Feb 24 - Mar 19, 2026)  
**Author:** Mark IJbema

### What changed

A series of commits moved dynamic editor context (active file, visible files,
open tabs) from the system prompt into per-message `<environment_details>` blocks
appended to the last user message. This went through several iterations:

1. **`f6da5ded8`** (Feb 24): Initial move — split editor context into static (system prompt) and dynamic (user message) parts. Created `environmentDetails()` function in `packages/opencode/src/kilocode/editor-context.ts`.

2. **`f46b73358`** (Feb 24): Added a static instruction to the system prompt explaining the `<environment_details>` block (~160 chars).

3. **`376cffa3c`** (Mar 17): Changed injection to be ephemeral — only injected at query time on the last user message, not persisted to storage. This prevents stale `environment_details` from accumulating across turns.

4. **`b38ccb77f`** (Mar 17): Added ISO 8601 timestamp with timezone to every `environment_details` block (always present, even without editor context). Changed return type from `string | undefined` to `string` — the block is now **always** injected.

5. **`22f83d215`** (Mar 17): Cached `envBlock` per turn for prompt caching efficiency.

6. **`22fad9db6`** (Mar 17): Re-keyed cache by user message ID to recompute when user message changes mid-loop.

7. **`801b561c3`** (Mar 17): Fixed mutation bug — use shallow copy instead of `parts.push()` to avoid duplicate blocks accumulating.

8. **`81c9cab4f`** (Mar 19): Removed the system prompt instruction about `<environment_details>` (net savings of ~160 chars from system prompt).

### Current state

File: `packages/opencode/src/kilocode/editor-context.ts`

Every LLM request now includes an `<environment_details>` block on the last user
message with at minimum:

```
<environment_details>
Current time: 2026-03-26T14:30:00+02:00
</environment_details>
```

When VS Code editor context is available, it can grow significantly:

```
<environment_details>
Current time: 2026-03-26T14:30:00+02:00
Active file: src/foo.ts
Visible files:
  src/foo.ts
  src/bar.ts
Open tabs:
  src/foo.ts
  src/bar.ts
  src/baz.ts
  ...
</environment_details>
```

### Token impact

- **Minimum (CLI, no editor):** ~60 chars (~15 tokens) per request — the timestamp line plus XML tags.
- **Typical (VS Code, 5-10 open tabs):** ~300-500 chars (~75-125 tokens) per request.
- **Heavy (VS Code, 30+ open tabs):** ~1000+ chars (~250+ tokens) per request.
- **Critical detail:** Only injected on the **last** user message ephemerally, NOT persisted. It does NOT accumulate across conversation turns in the stored messages. However, it IS present in every LLM API call.

### Risk assessment: LOW-MEDIUM

The ephemeral approach prevents accumulation, but the per-request overhead is
non-trivial for users with many open tabs. The timestamp alone is always
present, even for CLI users without any editor context.

---

## Change 3: Config Location Awareness in System Prompt

**PR:** #7444  
**Commit:** `57e36c7ea` (Mar 23, 2026)  
**Author:** Alex Alecu  
**Follow-ups:** `5d5433681`, `2847ec4a8`, `26f207e8f` (Mar 23)

### What changed

File: `packages/opencode/src/session/system.ts:70-71`

Added two lines to the `<env>` block in the system prompt:

```
  Project config: .kilo/ (command/*.md, agent/*.md, kilo.json, AGENTS.md)
  Global config: ~/.config/kilo/ (same structure)
```

### Token impact

- +~130 chars (~35 tokens) to every system prompt on every request.

### Risk assessment: LOW

Small fixed addition. Present in the system prompt which is prompt-cached.

---

## Change 4: `PlanExitTool` Always Registered

**Commit:** `4129abac9` (Mar 6, 2026)  
**Author:** Alex Alecu

### What changed

File: `packages/opencode/src/tool/registry.ts:124`

```diff
-...(Flag.KILO_EXPERIMENTAL_PLAN_MODE && Flag.KILO_CLIENT === "cli" ? [PlanExitTool] : []),
+PlanExitTool, // kilocode_change - always registered; gated by agent permission instead
```

Previously, `PlanExitTool` was only included when the experimental plan mode
flag was set AND the client was CLI. Now it's **always** registered in the tool
registry. The tool is still gated by agent permissions (only the `plan` agent
has `plan_exit: "allow"`), so it won't appear in tool calls for non-plan agents.
However, the tool registration means `ToolRegistry.all()` always includes it.

**Companion fix:** `4dc0ed0ff` added `plan_exit` to the BatchTool's `DISALLOWED`
set to prevent bypassing agent-level permission gating.

### Token impact

- The `plan_exit` tool description is ~614 bytes. However, `LLM.resolveTools()`
  filters tools by agent permissions, so it should NOT appear in the actual tool
  list sent to the LLM unless the agent allows it.
- **Net impact for most users: ZERO** — the tool is filtered out before reaching
  the LLM. But if the permission filtering has a bug, it would add ~614 bytes
  (~150 tokens) to every request.

### Risk assessment: LOW (properly gated by agent permissions)

---

## Change 5: Bash Tool Description Clarification

**Commit:** `e79d41c70` (Mar 3, 2026) — upstream PR #15928  
**Author:** Dax

### What changed

File: `packages/opencode/src/tool/bash.txt`

Single line reword (no net size change):

```diff
-  - If the output exceeds ${maxLines} lines or ${maxBytes} bytes, it will be truncated and the full output will be written to a file. You can use Read with offset/limit to read specific sections or Grep to search the full content. Because of this, you do NOT need to use `head`, `tail`, or other truncation commands to limit output - just run the command directly.
+  - If the output exceeds ${maxLines} lines or ${maxBytes} bytes, it will be truncated and the full output will be written to a file. You can use Read with offset/limit to read specific sections or Grep to search the full content. Do NOT use `head`, `tail`, or other truncation commands to limit output; the full output will already be captured to a file for more precise searching.
```

### Token impact: NEGLIGIBLE (same length, different wording)

---

## Change 6: Subagent Task Tool Blocking

**PR:** #7056  
**Commit:** `4ee4d49d9` (Mar 15, 2026)  
**Author:** Thomas Brugman

### What changed

File: `packages/opencode/src/tool/task.ts`

Modified subagent permission logic to conditionally allow the `task` tool in
subagent sessions (previously it was always denied). If an agent's permission
rules explicitly `allow` the `task` permission, subagents spawned by it can
also use the task tool.

### Token impact: NONE (runtime logic, no change to tool descriptions or schemas)

---

## Change 7: Granular Bash Permission Rules

**PR:** #7091  
**Commit:** `048431819` (Mar 16, 2026)  
**Author:** Imanol Maiztegui

### What changed

Files: `packages/opencode/src/tool/bash.ts`, `packages/opencode/src/kilocode/bash-hierarchy.ts`, `packages/opencode/src/permission/next.ts`

Added `metadata.rules` to bash tool permission requests containing hierarchical
always-approve patterns. This adds a `metadata` field to permission requests
but does NOT change tool descriptions or schemas sent to the LLM.

### Token impact: NONE (permission metadata, not tool definitions)

---

## Change 8: Session Diff Memory Leak Fix

**PR:** #7617  
**Branch:** `fix/session-diff-memory-leak`  
**Commits:** `54105335f` through `ab66954f4` (Mar 25-26, 2026)  
**Author:** Alex Alecu

### What changed

This is a performance fix, not a regression cause. It addresses a significant
memory issue for long-running sessions:

1. **`54105335f`**: Cap file content at 256 KB in `Snapshot.diffFull()` to prevent multi-MB strings.
2. **`7f57983c1`**: Strip `before`/`after` from TUI session_diff store.
3. **`59d1bbb6a`**: Use `git cat-file -s` to pre-check file size before reading.
4. **`24517648b`**: Scrub oversized diffs from stored `session_diff` JSON on read.
5. **`6878ddb03`**: Strip `summary.diffs` from messages in TUI store.
6. **`1a07ad1a5`**: Evict per-session data from TUI store on navigation.
7. **`6819ee758`**: Restart worker on `/new` to reclaim native memory.
8. **`1596cae38`**: Use subprocess instead of Worker thread for memory reclamation.

### Token impact: NONE (addresses storage/memory, not LLM context)

### Relevance to long session performance: HIGH

This fix directly addresses why long sessions become slow — multi-GB diff
strings were accumulating in session storage and the TUI Solid store, causing
memory pressure and slow session loading.

---

## Summary: Token Budget Changes

| Change                           | When            | Condition               | Per-request impact       |
| -------------------------------- | --------------- | ----------------------- | ------------------------ |
| `codebase_search` tool           | Mar 17          | Experimental flag ON    | +~350 tokens             |
| `environment_details` injection  | Feb 24 - Mar 19 | Always (ephemeral)      | +15 to +250 tokens       |
| Config paths in system prompt    | Mar 23          | Always                  | +~35 tokens              |
| `PlanExitTool` always registered | Mar 6           | Filtered by agent perms | 0 tokens (if perms work) |
| Bash description reword          | Mar 3           | Always                  | ~0 tokens                |

**Total worst case (all features enabled, VS Code with many tabs):** +~635 tokens per request

**Typical case (default settings, CLI):** +~50 tokens per request (environment_details timestamp + config paths)

---

## Recommendations

1. **Monitor `environment_details` size**: For VS Code users with many open tabs,
   the `<environment_details>` block can grow large. Consider capping the number
   of open tabs included (e.g., top 10) or omitting tabs that are not in the
   workspace.

2. **Timestamp always present**: The `environmentDetails()` function now always
   returns a block (never `undefined`). If the timestamp is not useful for the
   model, removing it would save ~15 tokens per request.

3. **Session diff memory**: PR #7617 fixes the most severe long-session issue.
   Ensure this fix is deployed.

4. **Tool description sizes**: The `bash.txt` (9.6 KB) and `todowrite.txt`
   (8.8 KB) descriptions are by far the largest. These account for ~18 KB
   (~4,500 tokens) of the ~39 KB total tool description payload. If token
   budget is a concern, these are the highest-value targets for compression.
