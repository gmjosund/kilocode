# Investigation: Session State Disappearing (#7671)

## 1. Where Session State Is Stored

### 1.1 Primary Storage: SQLite Database (Drizzle ORM + Bun SQLite)

| Property     | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Path         | `~/.local/share/kilo/kilo.db`                               |
| Mode         | WAL (Write-Ahead Logging)                                   |
| Sync         | `PRAGMA synchronous = NORMAL`                               |
| Busy timeout | 5000ms                                                      |
| Resolved at  | Module load time (`packages/opencode/src/storage/db.ts:30`) |

**Tables:**

| Table        | File                                                 | Purpose                                                               |
| ------------ | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `session`    | `packages/opencode/src/session/session.sql.ts:11-40` | Session records (id, project_id, title, version, summary, timestamps) |
| `message`    | `packages/opencode/src/session/session.sql.ts:42-53` | Chat messages (id, session_id, JSON with role/content/model)          |
| `part`       | `packages/opencode/src/session/session.sql.ts:55-67` | Message parts (text, tool calls, files, reasoning) as JSON            |
| `todo`       | `packages/opencode/src/session/session.sql.ts:69-85` | Per-session task list                                                 |
| `permission` | `packages/opencode/src/session/session.sql.ts:87-93` | Per-project permission rulesets                                       |
| `project`    | `packages/opencode/src/project/project.sql.ts:4-15`  | Project records (worktree path, VCS, name)                            |

**Key CRUD functions** (all in `packages/opencode/src/session/index.ts`):

| Operation      | Function                  | Line    |
| -------------- | ------------------------- | ------- |
| Create         | `Session.createNext()`    | 324-364 |
| Get            | `Session.get()`           | 373-377 |
| List           | `Session.list()`          | 566-607 |
| Delete         | `Session.remove()`        | 690-715 |
| Update message | `Session.updateMessage()` | 717-747 |
| Update part    | `Session.updatePart()`    | 796-827 |

### 1.2 Legacy Storage: Filesystem JSON (pre-SQLite)

| Property | Value                                                |
| -------- | ---------------------------------------------------- |
| Path     | `~/.local/share/kilo/storage/`                       |
| Format   | JSON files organized as `storage/<entity>/<id>.json` |

Still used for:

- Session diffs: `Storage.read(["session_diff", sessionID])` (`packages/opencode/src/session/index.ts:544`)
- Share metadata: `Storage.write(["session_share", sessionId], ...)` (`packages/opencode/src/kilo-sessions/kilo-sessions.ts:354`)

Migration from JSON to SQLite: `packages/opencode/src/storage/json-migration.ts`

### 1.3 In-Memory State (NOT persisted)

| State                      | File                                                    | Line    | What                                                         |
| -------------------------- | ------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| Session processors         | `packages/opencode/src/session/prompt.ts`               | 81-100  | Active LLM streaming state, abort controllers                |
| Session status (busy/idle) | `packages/opencode/src/session/status.ts`               | 44-75   | `Instance.state()` singleton per project                     |
| Platform overrides         | `packages/opencode/src/session/index.ts`                | 260-264 | Per-session platform model overrides                         |
| InFlight cache             | `packages/opencode/src/kilo-sessions/inflight-cache.ts` | 1-72    | TTL-based auth token/API client cache                        |
| Bus events                 | `packages/opencode/src/session/index.ts`                | 181-232 | In-process pub/sub (session.created, updated, deleted, etc.) |

### 1.4 VS Code Extension State

| Storage               | File                                                              | Persisted                        | What                                                       |
| --------------------- | ----------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `globalState`         | `packages/kilo-vscode/src/KiloProvider.ts:765-779`                | Yes (VS Code internal)           | Variant selections, recent models, dismissed notifications |
| Webview SolidJS store | `packages/kilo-vscode/webview-ui/src/context/session.tsx:274-284` | No                               | All session/message/part UI state                          |
| Agent Manager state   | `packages/kilo-vscode/src/agent-manager/WorktreeStateManager.ts`  | Yes (`.kilo/agent-manager.json`) | Worktree-session mappings, tab order, UI preferences       |

### 1.5 Prompt History

| Property | Value                                                            |
| -------- | ---------------------------------------------------------------- |
| Path     | `~/.local/state/kilo/prompt-history.jsonl`                       |
| Format   | JSONL, 50 entries max                                            |
| File     | `packages/opencode/src/cli/cmd/tui/component/prompt/history.tsx` |

---

## 2. All Consumers of Session State

### 2.1 Data Flow

```
Write path:
  Webview --> postMessage --> Extension Host --> SDK HTTP --> Server route
    --> Session.*() --> SQLite + Bus.publish() --> SSE broadcast --> all clients

Read path:
  Server Bus.subscribeAll() --> SSE stream --> Extension SSEClient
    --> mapSSEEventToWebviewMessage() --> postMessage --> Webview SolidJS store
```

### 2.2 CLI Backend (packages/opencode/)

| Consumer          | File                                 | Operations                                                                                    |
| ----------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Session namespace | `src/session/index.ts`               | Full CRUD (create, get, list, remove, updateMessage, updatePart, fork, share, setTitle, etc.) |
| SessionPrompt     | `src/session/prompt.ts`              | Processes prompts, manages streaming, publishes turn lifecycle events                         |
| SessionProcessor  | `src/session/processor.ts`           | Handles LLM streaming, tool execution, writes parts back to DB                                |
| SessionStatus     | `src/session/status.ts`              | Manages busy/idle/retry status (in-memory only)                                               |
| Todo              | `src/session/todo.ts`                | Per-session task list CRUD                                                                    |
| Summary           | `src/session/summary.ts`             | Computes and stores session diffs and summaries                                               |
| Revert            | `src/session/revert.ts`              | Session revert operations with diff tracking                                                  |
| ShareNext         | `src/share/share-next.ts`            | Syncs session data to opncd.ai                                                                |
| KiloSessions      | `src/kilo-sessions/kilo-sessions.ts` | Syncs to Kilo Sessions cloud ingest                                                           |

### 2.3 HTTP Server (packages/opencode/src/server/)

Over 30 REST endpoints under `/session/` in `src/server/routes/session.ts`, including:

- `GET /session` — list sessions
- `GET /session/:id` — get session
- `POST /session` — create session
- `DELETE /session/:id` — delete session
- `POST /session/:id/message` — send prompt
- `GET /session/:id/message` — get messages
- `GET /event` — SSE event stream broadcasting all bus events

### 2.4 VS Code Extension Host (packages/kilo-vscode/src/)

| Consumer                    | File                                        | Operations                                                                                                       |
| --------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| KiloProvider                | `src/KiloProvider.ts`                       | Routes webview messages to SDK, filters SSE events per webview, manages `currentSession` and `trackedSessionIds` |
| loadSessions util           | `src/kilo-provider-utils.ts:107`            | Fetches sessions from SDK for workspace + worktree directories                                                   |
| mapSSEEventToWebviewMessage | `src/kilo-provider-utils.ts:151-317`        | Transforms SSE events to webview messages                                                                        |
| AgentManagerProvider        | `src/agent-manager/AgentManagerProvider.ts` | Creates sessions in worktrees, tracks active session, re-registers sessions on clear                             |
| WorktreeStateManager        | `src/agent-manager/WorktreeStateManager.ts` | Persists worktree-session associations to `.kilo/agent-manager.json`                                             |
| seedSessionStatuses         | `src/session-status.ts`                     | Seeds initial session status on connection                                                                       |

### 2.5 Webview (packages/kilo-vscode/webview-ui/)

The `SessionProvider` (`webview-ui/src/context/session.tsx`) maintains the SolidJS store:

```typescript
interface SessionStore {
  sessions: Record<string, SessionInfo>
  messages: Record<string, Message[]>
  parts: Record<string, Part[]>
  todos: Record<string, TodoItem[]>
  modelSelections: Record<string, ModelSelection | null>
  sessionOverrides: Record<string, ModelSelection>
  agentSelections: Record<string, string>
  variantSelections: Record<string, string>
  recentModels: ModelSelection[]
}
```

**Inbound handlers** (extension --> webview): `sessionsLoaded`, `sessionCreated`, `sessionUpdated`, `sessionDeleted`, `messagesLoaded`, `messageCreated`, `messageRemoved`, `partUpdated`, `sessionStatus`, `sessionError`, `todoUpdated`

**Outbound actions** (webview --> extension): `createSession`, `sendMessage`, `sendCommand`, `abort`, `compact`, `loadSessions`, `loadMessages`, `deleteSession`, `renameSession`, `clearSession`, `syncSession`, `revertSession`, `unrevertSession`

### 2.6 SDK Client (packages/sdk/js/)

Auto-generated `Session2` class in `src/v2/gen/sdk.gen.ts` wrapping all `/session/` endpoints. Used by both the extension and CLI.

---

## 3. Most Likely Culprits for Session State Disappearing

### CRITICAL: No `Database.close()` During Shutdown

**Severity:** HIGH  
**Files:** `packages/opencode/src/storage/db.ts:112-118`, `packages/opencode/src/project/instance.ts:131-161`

`Database.close()` is **never called** anywhere in the codebase during normal shutdown. The `Instance.disposeAll()` function (called by `serve.ts` on SIGTERM) disposes per-project state but does NOT close the SQLite database. The only WAL checkpoint happens during initialization (`db.ts:87`), not shutdown.

With `PRAGMA synchronous = NORMAL`, recent writes may be in the WAL but not synced to the main database file. If the process is killed (SIGKILL) before the OS flushes, those writes are lost.

**Recommendation:** Add `Database.close()` call (with explicit `PRAGMA wal_checkpoint(TRUNCATE)`) to the serve.ts shutdown handler, before `abort.abort()`.

### CRITICAL: SIGKILL After 5 Seconds Can Kill Mid-Flush

**Severity:** HIGH  
**File:** `packages/kilo-vscode/src/services/cli-backend/server-manager.ts:177-199`

On extension deactivation, `ServerManager.dispose()`:

1. Sends SIGTERM to the CLI process group
2. Sets a 5-second timer for SIGKILL fallback

The serve.ts SIGTERM handler calls `Instance.disposeAll()` + `server.stop(true)`. If disposeAll takes >5s (e.g., flushing large active sessions, waiting for LLM responses to abort), the process is SIGKILL'd. With no explicit WAL checkpoint in the shutdown path, recent session data may be lost.

**Recommendation:** Increase the SIGKILL timeout. Add a `/shutdown` HTTP endpoint that the extension can call before SIGTERM to initiate graceful database close. Only SIGKILL after confirming the endpoint has responded (or a generous timeout).

### CRITICAL: `process.exit()` Without Database Close

**Severity:** HIGH  
**File:** `packages/opencode/src/index.ts:270`

In the TUI/CLI code path, `process.exit()` is called after `Instance.disposeAll()` but without calling `Database.close()`. This immediately terminates the process. The SIGHUP handler (line 74 area) also calls `process.exit()`.

**Recommendation:** Call `Database.close()` before `process.exit()`.

### HIGH: postMessage Drops Events When Webview Is Null

**Severity:** HIGH  
**File:** `packages/kilo-vscode/src/KiloProvider.ts:2426-2442`

When `this.webview` is null (between webview dispose and re-creation), all `postMessage` calls silently drop messages with only a console warning. This means:

- If a session sends messages while the sidebar is hidden and recycled by VS Code, those SSE events (session updates, message parts, status changes) are permanently lost from the webview's perspective
- The data still exists in SQLite but the UI never receives the update
- When the webview comes back, it only gets data from the last `sessionsLoaded` / `loadMessages` call

**Impact on #7671:** This is a very likely cause. If the user switches away from the Kilo sidebar (e.g., to Explorer or Git panel), VS Code may dispose the webview to save memory. Any session updates during that time are dropped. When the user returns, the webview is re-created but may show stale data until sessions are explicitly reloaded.

**Recommendation:** Buffer SSE events in memory when `this.webview` is null and flush them when the webview reconnects. The `pendingReviewComments` pattern already exists in KiloProvider as a precedent.

### HIGH: No Session Refresh After SSE Reconnection

**Severity:** HIGH  
**Files:** `packages/kilo-vscode/src/KiloProvider.ts:928-952`, `packages/kilo-vscode/src/services/cli-backend/sdk-sse-adapter.ts:115-175`

During SSE reconnection (250ms+ gap between disconnect and reconnect), events are dropped. On reconnection, `flushPendingSessionRefresh` is called but it only runs if `pendingSessionRefresh` is true. `syncWebviewState` does NOT reload the session list -- it only pushes connection state, profile, and seeds status.

This means: if an SSE event was dropped during reconnection (e.g., a `session.updated` or `message.part.updated`), the webview will have stale data with no mechanism to recover.

**Recommendation:** After SSE reconnection, always trigger a full session list reload and re-fetch messages for the currently active session. The `fetchAndSendPendingPermissions` pattern already exists for permissions recovery.

### MEDIUM: In-Flight LLM Responses Lost on Crash

**Severity:** MEDIUM  
**Files:** `packages/opencode/src/session/prompt.ts:81-100`, `packages/opencode/src/session/processor.ts`

Active LLM streaming state is held in-memory in `SessionPrompt.state` (an `Instance.state()` singleton). Parts are written to the database incrementally via `Session.updatePart()`, but there's a window between receiving LLM tokens and flushing them to the database. A crash during streaming means the last few token batches are lost.

**Recommendation:** This is acceptable for crash scenarios. Consider adding a "dirty session" marker to the database when streaming starts, cleared on completion, so the UI can show a "this session may have incomplete data" warning.

### MEDIUM: handleSessionsLoaded Reconciliation Deletes Unmatched Sessions

**Severity:** MEDIUM  
**File:** `packages/kilo-vscode/webview-ui/src/context/session.tsx:973-991`

When `sessionsLoaded` arrives, the handler reconciles the store by deleting sessions NOT in the loaded list (skipping `cloud:` prefixed ones). If the `loadSessions` call returns a partial list (e.g., due to a timeout, API error, or directory mismatch), sessions that actually exist in the database will be removed from the webview store.

```typescript
function handleSessionsLoaded(loaded: SessionInfo[]) {
  batch(() => {
    const ids = new Set(loaded.map((s) => s.id))
    setStore(
      "sessions",
      produce((sessions) => {
        for (const id of Object.keys(sessions)) {
          if (id.startsWith("cloud:")) continue
          if (!ids.has(id)) delete sessions[id] // <-- deletes "missing" sessions
        }
      }),
    )
    // ...
  })
}
```

**Impact on #7671:** If the extension's `loadSessions` fails to include sessions from a worktree directory (e.g., because the worktree was deleted or the directory is unreachable), those sessions vanish from the UI even though they exist in the database.

**Recommendation:** Only reconcile sessions of the same project. Add error handling so partial failures don't cause full reconciliation.

### MEDIUM: WorktreeStateManager Fire-and-Forget Saves

**Severity:** MEDIUM  
**File:** `packages/kilo-vscode/src/agent-manager/WorktreeStateManager.ts:162,195,228`

All mutations call `void this.save()` -- fire-and-forget. If the extension crashes before the save completes, worktree-session mappings are lost. The state file (`.kilo/agent-manager.json`) is the only persistence for which sessions belong to which worktrees.

**Recommendation:** For critical operations (addSession, removeWorktree), await the save.

### MEDIUM: SSE Event Filtering Drops Events for Untracked Sessions

**Severity:** MEDIUM  
**File:** `packages/kilo-vscode/src/KiloProvider.ts:906-926`

SSE events are filtered by `trackedSessionIds`. Child sessions created by the `task` tool or by forking are not immediately tracked. Events for these sessions are silently dropped until the webview explicitly loads them.

**Impact on #7671:** If a child session is created during a conversation (sub-agent), its updates won't appear until the parent session requests a sync.

### MEDIUM: Session Diff Writes Silently Swallowed

**Severity:** MEDIUM  
**File:** `packages/opencode/src/session/summary.ts:133`

```typescript
if (changed) Storage.write(["session_diff", input.sessionID], next).catch(() => {})
```

Write failures for session diffs are completely silently swallowed. If the filesystem is full or permissions change, diff data is lost with no indication.

### LOW: AgentManagerProvider Dual Session ID Tracking

**Severity:** LOW  
**Files:** `packages/kilo-vscode/src/agent-manager/AgentManagerProvider.ts:61-64, 392-395`

AgentManagerProvider maintains `activeSessionId` separately from KiloProvider's `currentSession`. This creates a potential split-brain during rapid tab switches where two parts of the code disagree about which session is active.

### LOW: Database.close() Missing WAL Checkpoint

**Severity:** LOW  
**File:** `packages/opencode/src/storage/db.ts:112-118`

Even if `Database.close()` were called, it only calls `sqlite.close()` without an explicit `PRAGMA wal_checkpoint(TRUNCATE)` first. While SQLite's `close()` should attempt a checkpoint, an explicit TRUNCATE checkpoint before close is more reliable, especially under crash scenarios.

---

## Summary: Prioritized Fix List

| Priority | Issue                                              | Fix                                                                               |
| -------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| P0       | No Database.close() on shutdown                    | Add `Database.close()` with WAL checkpoint to serve.ts shutdown and index.ts exit |
| P0       | postMessage drops during webview transitions       | Buffer events when webview is null, flush on reconnect                            |
| P0       | No session refresh after SSE reconnection          | Always reload active session data after reconnection                              |
| P1       | SIGKILL timeout too aggressive                     | Add graceful shutdown endpoint; increase SIGKILL timeout                          |
| P1       | handleSessionsLoaded reconciliation too aggressive | Only reconcile within the same project; handle partial failures                   |
| P2       | WorktreeStateManager fire-and-forget saves         | Await critical saves                                                              |
| P2       | Untracked child session events dropped             | Auto-track child sessions from parent                                             |
| P2       | Silent diff write failures                         | Add error logging                                                                 |
| P3       | Dual session ID tracking in Agent Manager          | Unify tracking                                                                    |
