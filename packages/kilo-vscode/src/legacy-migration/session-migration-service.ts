import * as vscode from "vscode"
import type { KiloClient } from "@kilocode/sdk/v2/client"
import type { LegacyHistoryItem } from "./legacy-session-types"
import { normalizeSession } from "./session-normalizer"

export async function migrateSession(input: {
  id: string
  context: vscode.ExtensionContext
  client: KiloClient
}) {
  const dir = vscode.Uri.joinPath(input.context.globalStorageUri, "tasks").fsPath
  const items = input.context.globalState.get<LegacyHistoryItem[]>("taskHistory", [])
  const item = items.find((item) => item.id === input.id)
  const payload = await normalizeSession({
    id: input.id,
    dir,
    item,
  })

  // await input.client.session.import(payload, { throwOnError: true })

  // Adjust return based on backend call response
  return {
    ok: true,
    payload,
  }
}
