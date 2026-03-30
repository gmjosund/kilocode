import { Database, eq } from "../../storage/db"
import { ProjectTable } from "../../project/project.sql"
import { SessionTable, MessageTable, PartTable } from "../../session/session.sql"
import { SessionImportType } from "./types"

const key = (input: unknown) => [input] as never

export namespace SessionImportService {
  export async function project(input: SessionImportType.Project): Promise<SessionImportType.Result> {
    // If this worktree already has a project in kilo.db, reuse that project's id so migrated
    // sessions end up attached to the same project as sessions created later by normal Kilo flows.
    const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.worktree, input.worktree)).get())
    const id = row?.id ?? input.id

    Database.use((db) => {
      db.insert(ProjectTable)
        .values({
          id,
          worktree: input.worktree,
          vcs: input.vcs,
          name: input.name,
          icon_url: input.iconUrl,
          icon_color: input.iconColor,
          time_created: input.timeCreated,
          time_updated: input.timeUpdated,
          time_initialized: input.timeInitialized,
          sandboxes: input.sandboxes,
          commands: input.commands,
        })
        .onConflictDoUpdate({
          target: key(ProjectTable.id),
          set: {
            worktree: input.worktree,
            vcs: input.vcs,
            name: input.name,
            icon_url: input.iconUrl,
            icon_color: input.iconColor,
            time_updated: input.timeUpdated,
            time_initialized: input.timeInitialized,
            sandboxes: input.sandboxes,
            commands: input.commands,
          },
        })
        .run()
    })
    return { ok: true, id }
  }

  export async function session(input: SessionImportType.Session): Promise<SessionImportType.Result> {
    Database.use((db) => {
      db.insert(SessionTable)
        .values({
          id: input.id,
          project_id: input.projectID,
          workspace_id: input.workspaceID,
          parent_id: input.parentID,
          slug: input.slug,
          directory: input.directory,
          title: input.title,
          version: input.version,
          share_url: input.shareURL,
          summary_additions: input.summary?.additions,
          summary_deletions: input.summary?.deletions,
          summary_files: input.summary?.files,
          summary_diffs: input.summary?.diffs as never,
          revert: input.revert,
          permission: input.permission as never,
          time_created: input.timeCreated,
          time_updated: input.timeUpdated,
          time_compacting: input.timeCompacting,
          time_archived: input.timeArchived,
        })
        .onConflictDoUpdate({
          target: key(SessionTable.id),
          set: {
            project_id: input.projectID,
            workspace_id: input.workspaceID,
            parent_id: input.parentID,
            slug: input.slug,
            directory: input.directory,
            title: input.title,
            version: input.version,
            share_url: input.shareURL,
            summary_additions: input.summary?.additions,
            summary_deletions: input.summary?.deletions,
            summary_files: input.summary?.files,
            summary_diffs: input.summary?.diffs as never,
            revert: input.revert,
            permission: input.permission as never,
            time_updated: input.timeUpdated,
            time_compacting: input.timeCompacting,
            time_archived: input.timeArchived,
          },
        })
        .run()
    })
    return { ok: true, id: input.id }
  }

  export async function message(input: SessionImportType.Message): Promise<SessionImportType.Result> {
    Database.use((db) => {
      db.insert(MessageTable)
        .values({
          id: input.id,
          session_id: input.sessionID,
          time_created: input.timeCreated,
          data: input.data as never,
        })
        .onConflictDoUpdate({
          target: key(MessageTable.id),
          set: {
            data: input.data as never,
          },
        })
        .run()
    })
    return { ok: true, id: input.id }
  }

  export async function part(input: SessionImportType.Part): Promise<SessionImportType.Result> {
    Database.use((db) => {
      db.insert(PartTable)
        .values({
          id: input.id,
          message_id: input.messageID,
          session_id: input.sessionID,
          time_created: input.timeCreated,
          data: input.data as never,
        })
        .onConflictDoUpdate({
          target: key(PartTable.id),
          set: {
            data: input.data as never,
          },
        })
        .run()
    })
    return { ok: true, id: input.id }
  }
}
