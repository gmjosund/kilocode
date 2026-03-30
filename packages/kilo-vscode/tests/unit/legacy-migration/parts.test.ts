import { describe, expect, it } from "bun:test"
import { parsePartsFromConversation } from "../../../src/legacy-migration/sessions/lib/parts/parts"
import type { LegacyApiMessage } from "../../../src/legacy-migration/sessions/lib/legacy-types"

type Data = ReturnType<typeof parsePartsFromConversation>[number]["data"]
type Text = Extract<Data, { type: "text" }>

function text(list: ReturnType<typeof parsePartsFromConversation>) {
  return list.filter((x): x is (typeof list)[number] & { data: Text } => x.data.type === "text").map((x) => x.data.text)
}

const id = "019d3df5-d5d9-73dc-bc2c-43a6304ac62c"
const item = {
  id,
  ts: 1774861014564,
  task: "In this folder I need you to create 3 python files with random content, oriented towards web development",
  workspace: "/workspace/testing-4",
  mode: "code",
}

function sample(): LegacyApiMessage[] {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "<task>\nIn this folder I need you to create 3 python files with random content, oriented towards web development\n</task>",
        },
        {
          type: "text",
          text: "<environment_details>\nCurrent time: 2026-03-30T12:54:59+02:00\n</environment_details>",
        },
      ],
      ts: 1774861014564,
    },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "\n\nI'll create 3 Python files with web development-oriented content.",
        },
      ],
      ts: 1774861031791,
    },
    {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "toolu_attempt_1",
          name: "attempt_completion",
          input: {
            result: "Created 3 Python files with web development content.",
          },
        },
      ],
      ts: 1774861079951,
    },
  ]
}

describe("legacy migration parts", () => {
  it("converts plain text and text blocks into visible text parts without losing content", async () => {
    const list = parsePartsFromConversation(sample(), id, item)

    const items = text(list)

    expect(items.some((x) => x.includes("In this folder I need you to create 3 python files"))).toBe(true)
    expect(items.some((x) => x.includes("I'll create 3 Python files with web development-oriented content."))).toBe(
      true,
    )
  })

  it("drops standalone environment_details blocks but keeps the real task text", async () => {
    const list = parsePartsFromConversation(sample(), id, item)

    const items = text(list)

    expect(items.some((x) => x.includes("<environment_details>"))).toBe(false)
    expect(items.some((x) => x.includes("In this folder I need you to create 3 python files"))).toBe(true)
  })

  it("preserves attempt_completion input.result as assistant-visible text", async () => {
    const list = parsePartsFromConversation(sample(), id, item)

    const items = text(list)

    expect(items.some((x) => x.includes("Created 3 Python files with web development content"))).toBe(true)
  })
})
