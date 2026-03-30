import * as vscode from "vscode"
import type { KiloClient } from "@kilocode/sdk/v2/client"
import type { LegacyHistoryItem } from "./lib/legacy-types"
import { parseSession } from "./parser"

export async function migrate(id: string, context: vscode.ExtensionContext, client: KiloClient) {
  const dir = vscode.Uri.joinPath(context.globalStorageUri, "tasks").fsPath
  const items = context.globalState.get<LegacyHistoryItem[]>("taskHistory", [])
  const item = items.find((item) => item.id === id)
  const payload = await parseSession(id, dir, item)

  try {
    const project = await client.kilocode.sessionImport.project(payload.project, { throwOnError: true })
    const projectID = project.data?.id ?? payload.project.id
    await client.kilocode.sessionImport.session(
      {
        ...payload.session,
        projectID,
        query_directory: payload.session.directory,
        body_directory: payload.session.directory,
      },
      { throwOnError: true },
    )

    for (const msg of payload.messages) {
      await client.kilocode.sessionImport.message(msg, { throwOnError: true })
    }

    for (const part of payload.parts) {
      await client.kilocode.sessionImport.part(part, { throwOnError: true })
    }

    await context.globalState.update(`kilo.migratedSession.${payload.session.id}`, true)

    return {
      ok: true,
      payload,
    }
  } catch (error) {
    return {
      ok: false,
      payload,
      error,
    }
  }
}
