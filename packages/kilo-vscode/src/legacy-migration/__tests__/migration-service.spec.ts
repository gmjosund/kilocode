// @ts-nocheck

import { describe, it } from "vitest"

describe("detectLegacyData sessions", () => {
  it.todo("lists session ids from legacy global storage tasks directory")
  it.todo("omits sessions when the legacy tasks directory is missing")
  it.todo("ignores non-directory entries inside the legacy tasks directory")
})

describe("normalizeSession", () => {
  it.todo("builds project data from the legacy history item")
  it.todo("builds session data from the session id and sessions directory")
  it.todo("builds normalized messages from effective api conversation history")
  it.todo("builds normalized parts for text, tool use, and tool result entries")
})
