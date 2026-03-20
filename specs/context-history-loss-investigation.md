# Bug Investigation: CLI Loses Conversation History Mid-Session

## Bug Description

A user reports that while using the CLI to do a task, the CLI "suddenly seemed to forget a lot of its history and started reprocessing my task, but it got confused because all the files were already there." Essentially, mid-session the CLI loses its conversation/context history and restarts the task from scratch, leading to confusion because files were already created.

## Investigation Summary

After examining all PRs merged in the last 7 days (March 13–20, 2026) that touch CLI code paths, and thoroughly reviewing the conversation history, context management, compaction, and message handling subsystems in `packages/opencode/`, I identified three categories of changes that could cause this bug, ranked by likelihood.

---

## Most Likely Culprit: PR #6225 — "refactor: move dynamic editor context from system prompt to user message"

**Merged:** March 19, 2026  
**Author:** Mark IJbema  
**Branch:** `mark/move-dynamic-context-to-user-message`  
**Files changed:** `packages/opencode/src/session/prompt.ts`, `packages/opencode/src/kilocode/editor-context.ts`, `packages/opencode/src/session/system.ts`

### What it does

This PR moves dynamic editor context (active file, visible files, open tabs) from the system prompt into a synthetic `<environment_details>` text part injected into the **last user message** on every loop iteration. The goal was to provide the model with fresh editor state each turn instead of stale cached system prompt data.

### Why it's the most likely culprit

This PR required **6 follow-up bug-fix commits** within 48 hours, indicating significant instability:

1. **`376cffa3c`** — "inject environment_details ephemerally to avoid stale accumulation across turns"  
   The original implementation persisted the environment details to the database (via `Session.updatePart`). This meant that on each loop iteration, a new `<environment_details>` text part was **permanently appended** to the user message. Over multiple tool-call steps, this caused the user message to grow with duplicate environment blocks, inflating token counts.

2. **`22f83d215`** — "cache environment_details per turn for prompt caching"  
   Used `??=` to avoid recomputing, but this meant the first computation was cached forever.

3. **`22fad9db6`** — "recompute environment_details when user message changes mid-loop"  
   Fixed the caching to be keyed by user message ID.

4. **`801b561c3`** — "avoid mutating stored message when injecting environment_details"  
   **Critical fix.** The ephemeral injection was using `parts.push()` which **mutated the stored message object in memory**. Since `filterCompacted()` returns the same objects across loop iterations, the environment_details block was being duplicated on every loop step despite being "ephemeral." This caused token inflation that could trigger premature compaction.

5. **`628f12a6b`** — "preserve editor context on synthetic summary user messages"  
   Fixed missing `editorContext` on synthetic messages created after `task.command`.

6. **`aee00686d`** — "add required id fields to ephemeral environment details part"  
   The injected TextPart was missing `id`, `sessionID`, and `messageID` fields.

### The mechanism causing history loss

The chain of events:

1. PR #6225 injects `<environment_details>` into the last user message on each loop iteration
2. Despite fix `801b561c3`, the shallow copy (`msgs[idx] = { ...msgs[idx], parts: [...msgs[idx].parts, envPart] }`) creates a **new array** each iteration but the underlying parts objects may still reference cached data
3. The token count reported by the LLM after each step reflects the full context including environment details
4. `SessionCompaction.isOverflow()` (compaction.ts:32-48) checks if `tokens.total >= usable` where `usable = model.limit.input - reserved`
5. When token count crosses the threshold, `processor.ts:305-310` sets `needsCompaction = true`
6. The loop returns `"compact"`, and `SessionCompaction.create()` is called (prompt.ts:791-799)
7. Compaction runs `SessionCompaction.process()` which:
   - Creates a summary of the conversation (compaction.ts:101-294)
   - If `overflow: true`, finds a user message to "replay" after compaction
   - Creates a new user message with just "Continue if you have next steps..."
8. On the next loop iteration, `filterCompacted()` (message-v2.ts:819-835) finds the compaction summary and **drops all messages before the compaction boundary**
9. The model now only sees: the compaction summary + the replay/continue message
10. If the compaction summary is incomplete or the model doesn't understand the context, it restarts the task from scratch

**The key insight:** The environment details injection inflates the token count on every step, and the `isOverflow` check uses the **cumulative token count from the LLM response** (which includes all context tokens). This means compaction triggers earlier than expected, and the model loses fine-grained history — only receiving a summary.

### Evidence of ongoing instability

The 6 follow-up fixes in rapid succession (all within March 17–19) demonstrate this feature was actively causing issues. The `parts.push()` mutation bug (`801b561c3`) is particularly dangerous because it compounds token growth silently.

---

## Contributing Factor: PR #7172 (commit `13ff40c58`) — "fix: don't dispose all instances on global config update"

**Merged:** March 17, 2026  
**Author:** Mark IJbema  
**Follow-up:** `a3c2b233e` — "invalidate per-instance config caches on global config update"

### What it does

Before this fix, `Config.updateGlobal()` called `Instance.disposeAll()` on every global config change, which destroyed all session state, MCP connections, and in-flight operations. The fix removed `Instance.disposeAll()` and replaced it with `State.resetCaches()` to only clear config caches.

### How it could contribute

If the VS Code extension triggers a config update (e.g., user changes a setting, permission save, marketplace install) while the CLI is mid-session:

1. `State.resetCaches()` clears all derived state caches
2. On the next config read, state is recomputed fresh
3. This could cause the session loop to behave unexpectedly if any cached state (like agent config, compaction thresholds, or model info) changes between loop iterations
4. The `compaction.reserved` value from config could change, altering the overflow threshold

### Why it's a contributing factor, not the primary cause

This would only trigger if a config change happens during a session. The user's description ("suddenly seemed to forget") is more consistent with the compaction mechanism than a config reset.

---

## Less Likely but Worth Noting: PR #7083 — "Reduce memory 6x by moving to tsgo for typechecks"

**Merged:** March 17, 2026

### What it does

Replaces the persistent `typescript-language-server` with on-demand `tsgo --noEmit --incremental` calls. Zero idle memory vs 500MB+.

### Why it's unlikely to be the cause

This PR only changes the TypeScript diagnostic pipeline (`packages/opencode/src/kilocode/ts-check.ts`, `packages/opencode/src/kilocode/ts-client.ts`, `packages/opencode/src/lsp/`). It doesn't touch conversation history, message handling, or compaction. However, if `tsgo` diagnostics produce significantly larger output than the old language server, this could contribute to faster context window fill-up and earlier compaction triggers.

---

## Recommended Fix

The root issue is that context compaction, while functioning as designed, is triggering too aggressively due to token inflation from the environment details injection. The fix should address:

1. **Ensure environment details don't inflate token counts**: The `<environment_details>` block should not cause the `isOverflow` check to trigger prematurely. Consider excluding environment details from the token count used for overflow detection, or account for them in the `reserved` buffer.

2. **Improve compaction summary quality**: When compaction does trigger, the summary should preserve enough context that the model doesn't restart the task. The current compaction prompt (compaction.ts:173-199) asks for a "detailed prompt for continuing," but if the model's summary misses critical file-creation context, the next model iteration won't know what's already done.

3. **Add compaction event logging visible to users**: Users should be informed when compaction occurs so they can distinguish between "the model forgot" and "the model was deliberately summarized."

4. **Consider a more conservative overflow threshold**: The current `COMPACTION_BUFFER` of 20,000 tokens (compaction.ts:30) may be too small for sessions with many tool calls and environment details. Increasing this buffer would delay compaction and preserve more history.

## Files to Review

| File                                                     | Relevance                                 |
| -------------------------------------------------------- | ----------------------------------------- |
| `packages/opencode/src/session/prompt.ts:704-726`        | Environment details injection site        |
| `packages/opencode/src/session/compaction.ts:32-48`      | `isOverflow()` — overflow detection       |
| `packages/opencode/src/session/compaction.ts:58-99`      | `prune()` — tool output clearing          |
| `packages/opencode/src/session/compaction.ts:101-294`    | `process()` — compaction execution        |
| `packages/opencode/src/session/message-v2.ts:819-835`    | `filterCompacted()` — history truncation  |
| `packages/opencode/src/session/processor.ts:305-310`     | Overflow check in stream processor        |
| `packages/opencode/src/kilocode/editor-context.ts:39-57` | `environmentDetails()` — injected content |
