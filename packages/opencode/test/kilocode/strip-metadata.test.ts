// kilocode_change - tests for stripPartMetadata and stripMessageMetadata
// These functions prevent multi-MB payloads from being returned in API responses
// by stripping full file contents from tool metadata and user message diffs.
import { describe, expect, test } from "bun:test"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionID, MessageID, PartID } from "../../src/session/schema"

const sessionID = SessionID.make("test-session")
const messageID = MessageID.make("test-message")

describe("stripPartMetadata", () => {
  test("returns non-tool parts unchanged", () => {
    const part: MessageV2.Part = {
      id: PartID.make("part-1"),
      sessionID,
      messageID,
      type: "text",
      text: "hello world",
    }
    expect(MessageV2.stripPartMetadata(part)).toBe(part)
  })

  test("returns tool parts without metadata unchanged", () => {
    const part: MessageV2.Part = {
      id: PartID.make("part-1"),
      sessionID,
      messageID,
      type: "tool",
      callID: "call-1",
      tool: "bash",
      state: {
        status: "completed",
        input: { command: "ls" },
        output: "file.txt",
        title: "bash",
        metadata: {},
        time: { start: 1, end: 2 },
      },
    }
    expect(MessageV2.stripPartMetadata(part)).toBe(part)
  })

  test("strips filediff.before/after from edit tool metadata", () => {
    const part: MessageV2.Part = {
      id: PartID.make("part-1"),
      sessionID,
      messageID,
      type: "tool",
      callID: "call-1",
      tool: "edit",
      state: {
        status: "completed",
        input: {},
        output: "edited",
        title: "edit",
        metadata: {
          filediff: {
            file: "src/index.ts",
            before: "A".repeat(100_000),
            after: "B".repeat(100_000),
            additions: 5,
            deletions: 3,
          },
        },
        time: { start: 1, end: 2 },
      },
    }
    const result = MessageV2.stripPartMetadata(part)
    expect(result).not.toBe(part)
    expect(result.type).toBe("tool")
    if (result.type !== "tool") throw new Error("expected tool")
    if (result.state.status !== "completed") throw new Error("expected completed")
    const meta = result.state.metadata as Record<string, any>
    expect(meta.filediff.file).toBe("src/index.ts")
    expect(meta.filediff.additions).toBe(5)
    expect(meta.filediff.before).toBeUndefined()
    expect(meta.filediff.after).toBeUndefined()
  })

  test("strips files[].before/after from apply_patch tool metadata", () => {
    const part: MessageV2.Part = {
      id: PartID.make("part-1"),
      sessionID,
      messageID,
      type: "tool",
      callID: "call-1",
      tool: "apply_patch",
      state: {
        status: "completed",
        input: {},
        output: "patched",
        title: "apply_patch",
        metadata: {
          files: [
            { file: "a.ts", before: "X".repeat(50_000), after: "Y".repeat(50_000), additions: 1, deletions: 1 },
            { file: "b.ts", before: "Z".repeat(50_000), after: "W".repeat(50_000), additions: 2, deletions: 2 },
          ],
        },
        time: { start: 1, end: 2 },
      },
    }
    const result = MessageV2.stripPartMetadata(part)
    expect(result).not.toBe(part)
    if (result.type !== "tool") throw new Error("expected tool")
    if (result.state.status !== "completed") throw new Error("expected completed")
    const meta = result.state.metadata as Record<string, any>
    expect(meta.files).toHaveLength(2)
    expect(meta.files[0].file).toBe("a.ts")
    expect(meta.files[0].additions).toBe(1)
    expect(meta.files[0].before).toBeUndefined()
    expect(meta.files[0].after).toBeUndefined()
    expect(meta.files[1].file).toBe("b.ts")
    expect(meta.files[1].before).toBeUndefined()
  })

  test("returns pending tool parts unchanged", () => {
    const part: MessageV2.Part = {
      id: PartID.make("part-1"),
      sessionID,
      messageID,
      type: "tool",
      callID: "call-1",
      tool: "bash",
      state: {
        status: "pending",
        input: { command: "ls" },
        raw: "ls",
      },
    }
    expect(MessageV2.stripPartMetadata(part)).toBe(part)
  })

  test("is idempotent — stripping already-stripped part returns same object", () => {
    const part: MessageV2.Part = {
      id: PartID.make("part-1"),
      sessionID,
      messageID,
      type: "tool",
      callID: "call-1",
      tool: "edit",
      state: {
        status: "completed",
        input: {},
        output: "edited",
        title: "edit",
        metadata: {
          filediff: {
            file: "src/index.ts",
            additions: 5,
            deletions: 3,
          },
        },
        time: { start: 1, end: 2 },
      },
    }
    // No before/after present — should return same reference
    expect(MessageV2.stripPartMetadata(part)).toBe(part)
  })
})

describe("stripMessageMetadata", () => {
  test("returns assistant messages unchanged", () => {
    const msg: MessageV2.Info = {
      id: MessageID.make("msg-1"),
      sessionID,
      role: "assistant",
      time: { created: 1 },
      modelID: "test" as any,
      providerID: "test" as any,
      mode: "code",
      agent: "code",
      path: { cwd: "/", root: "/" },
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      cost: 0,
    } as MessageV2.Info
    expect(MessageV2.stripMessageMetadata(msg)).toBe(msg)
  })

  test("returns user messages without summary unchanged", () => {
    const msg: MessageV2.Info = {
      id: MessageID.make("msg-1"),
      sessionID,
      role: "user",
      time: { created: 1 },
      agent: "code",
      model: { providerID: "test" as any, modelID: "test" as any },
    } as MessageV2.Info
    expect(MessageV2.stripMessageMetadata(msg)).toBe(msg)
  })

  test("strips summary.diffs before/after from user messages", () => {
    const msg = {
      id: MessageID.make("msg-1"),
      sessionID,
      role: "user",
      time: { created: 1 },
      agent: "code",
      model: { providerID: "test" as any, modelID: "test" as any },
      summary: {
        title: "test changes",
        body: "made some changes",
        diffs: [
          { file: "a.ts", before: "A".repeat(100_000), after: "B".repeat(100_000), additions: 5, deletions: 3 },
          { file: "b.ts", before: "C".repeat(100_000), after: "D".repeat(100_000), additions: 5, deletions: 2 },
        ],
      },
    } as MessageV2.Info
    const result = MessageV2.stripMessageMetadata(msg)
    expect(result).not.toBe(msg)
    if (result.role !== "user") throw new Error("expected user")
    const user = result as MessageV2.User
    expect(user.summary?.diffs).toHaveLength(2)
    expect(user.summary?.diffs?.[0].file).toBe("a.ts")
    expect(user.summary?.diffs?.[0].before).toBe("")
    expect(user.summary?.diffs?.[0].after).toBe("")
    expect(user.summary?.diffs?.[1].before).toBe("")
    expect(user.summary?.title).toBe("test changes")
  })

  test("returns user messages with empty diffs unchanged", () => {
    const msg = {
      id: MessageID.make("msg-1"),
      sessionID,
      role: "user",
      time: { created: 1 },
      agent: "code",
      model: { providerID: "test" as any, modelID: "test" as any },
      summary: {
        diffs: [],
      },
    } as MessageV2.Info
    expect(MessageV2.stripMessageMetadata(msg)).toBe(msg)
  })
})
