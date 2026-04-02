/**
 * Section drag-and-drop helpers. Separated from section-helpers.ts to avoid
 * pulling solid-dnd into test environments.
 */
import { closestCenter } from "@thisbeyond/solid-dnd"
import type { CollisionDetector } from "@thisbeyond/solid-dnd"
import type { VSCodeAPI } from "../src/types/messages"

/**
 * Collision detector that prioritizes section drop zones when a worktree is
 * dragged (checks bounding box, not just center). For section-to-section
 * drags, only considers other sections. Falls back to closestCenter.
 */
export function sectionAwareDetector(secIds: Set<string>): CollisionDetector {
  return (draggable, droppables, ctx) => {
    const id = draggable.id as string
    if (!secIds.has(id)) {
      const pt = draggable.transformed.center
      for (const d of droppables) {
        if (!secIds.has(d.id as string)) continue
        const { top, bottom, left, right } = d.layout
        if (pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom) return d
      }
    }
    const targets = secIds.has(id) ? droppables.filter((d) => secIds.has(d.id as string)) : droppables
    return closestCenter(draggable, targets, ctx)
  }
}

/** Centralized section message dispatcher. */
export function createSectionActions(vscode: VSCodeAPI) {
  return {
    create: (name: string, color: string, ids?: string[]) =>
      vscode.postMessage({ type: "agentManager.createSection", name, color, worktreeIds: ids }),
    rename: (id: string, name: string) =>
      vscode.postMessage({ type: "agentManager.renameSection", sectionId: id, name }),
    remove: (id: string) => vscode.postMessage({ type: "agentManager.deleteSection", sectionId: id }),
    color: (id: string, color: string | null) =>
      vscode.postMessage({ type: "agentManager.setSectionColor", sectionId: id, color }),
    toggle: (id: string) => vscode.postMessage({ type: "agentManager.toggleSectionCollapsed", sectionId: id }),
    move: (ids: string[], sec: string | null) =>
      vscode.postMessage({ type: "agentManager.moveToSection", worktreeIds: ids, sectionId: sec }),
    order: (order: string[]) => vscode.postMessage({ type: "agentManager.setWorktreeOrder", order }),
  }
}
