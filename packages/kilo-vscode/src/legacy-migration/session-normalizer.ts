import type { LegacyHistoryItem } from "./legacy-session-types"
import type { SessionImport } from "./session-types"

export async function normalizeSession(_input: {
  id: string
  dir: string
  item?: LegacyHistoryItem
}): Promise<SessionImport> {
  throw new Error("normalizeSession is not implemented yet")
}
