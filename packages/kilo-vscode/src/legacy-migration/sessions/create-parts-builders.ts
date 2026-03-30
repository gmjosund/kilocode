import type { KilocodeSessionImportPartData as Part } from "@kilocode/sdk/v2"
import { cleanLegacyTaskText, record } from "./create-parts-util"

type Body = NonNullable<Part["body"]>
type Data = Body["data"]
type Text = Extract<Data, { type: "text" }>
type Reasoning = Extract<Data, { type: "reasoning" }>
type Tool = Extract<Data, { type: "tool" }>
type ToolCompleted = Extract<Tool["state"], { status: "completed" }>

export function createToolUsePart(
  partID: string,
  messageID: string,
  sessionID: string,
  created: number,
  part: { type?: string; id?: string; name?: string; input?: unknown },
): NonNullable<Part["body"]> {
  const tool = typeof part.name === "string" ? part.name : "unknown"
  const state: ToolCompleted = {
    status: "completed",
    input: record(part.input),
    output: tool,
    title: tool,
    metadata: {},
    time: {
      start: created,
      end: created,
    },
  }

  const data: Tool = {
    type: "tool",
    callID: part.id ?? partID,
    tool,
    state,
  }

  return {
    id: partID,
    messageID,
    sessionID,
    timeCreated: created,
    data,
  }
}

export function createSimpleTextPart(
  partID: string,
  messageID: string,
  sessionID: string,
  created: number,
  text: string,
): NonNullable<Part["body"]> {
  const value = cleanLegacyTaskText(text)
  const data: Text = {
    type: "text",
    text: value,
    time: {
      start: created,
      end: created,
    },
  }

  return {
    id: partID,
    messageID,
    sessionID,
    timeCreated: created,
    data,
  }
}

export function createTextPartWithinMessage(
  partID: string,
  messageID: string,
  sessionID: string,
  created: number,
  text: string,
): NonNullable<Part["body"]> {
  const value = cleanLegacyTaskText(text)
  const data: Text = {
    type: "text",
    text: value,
    time: {
      start: created,
      end: created,
    },
  }

  return {
    id: partID,
    messageID,
    sessionID,
    timeCreated: created,
    data,
  }
}

export function createReasoningPart(
  partID: string,
  messageID: string,
  sessionID: string,
  created: number,
  text: string,
): NonNullable<Part["body"]> {
  const data: Reasoning = {
    type: "reasoning",
    text,
    time: {
      start: created,
      end: created,
    },
  }

  return {
    id: partID,
    messageID,
    sessionID,
    timeCreated: created,
    data,
  }
}
