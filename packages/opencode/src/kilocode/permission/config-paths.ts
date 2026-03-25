import path from "path"
import { Global } from "@/global"
import { KilocodePaths } from "@/kilocode/paths"

export namespace ConfigProtection {
  /**
   * Config directory prefixes (relative paths, forward-slash normalized).
   * Matches .kilo/, .kilocode/, .opencode/ at any depth within the project.
   */
  const CONFIG_DIRS = [".kilo/", ".kilocode/", ".opencode/"]

  /**
   * Root-level config files that must be protected.
   * Matched only when the relative path has no directory component.
   */
  const CONFIG_ROOT_FILES = new Set(["kilo.json", "kilo.jsonc", "opencode.json", "opencode.jsonc", "AGENTS.md"])

  function normalize(p: string): string {
    return p.replaceAll("\\", "/")
  }

  /** Check if a project-relative path points to a config file or directory. */
  export function isRelative(pattern: string): boolean {
    const normalized = normalize(pattern)
    for (const dir of CONFIG_DIRS) {
      if (normalized === dir.slice(0, -1) || normalized.startsWith(dir)) return true
    }
    return CONFIG_ROOT_FILES.has(normalized)
  }

  /** Check if an absolute path is inside a known CLI config directory. */
  export function isAbsolute(filepath: string): boolean {
    const resolved = path.resolve(filepath)

    // ~/.config/kilo/ (XDG config)
    const xdg = path.resolve(Global.Path.config)
    if (resolved === xdg || resolved.startsWith(xdg + path.sep)) return true

    // ~/.kilo/ and ~/.kilocode/ (legacy global dirs)
    for (const dir of KilocodePaths.globalDirs()) {
      const abs = path.resolve(dir)
      if (resolved === abs || resolved.startsWith(abs + path.sep)) return true
    }

    return false
  }

  /**
   * Determine if a permission request targets config files.
   * Only checks `edit` permission — read access is not restricted.
   */
  export function isRequest(request: {
    permission: string
    patterns: string[]
    metadata?: Record<string, any>
  }): boolean {
    if (request.permission !== "edit") return false

    // Check relative patterns (edit tool, apply_patch)
    for (const pattern of request.patterns) {
      if (isRelative(pattern)) return true
    }

    // Check metadata.filepath (absolute for edit, comma-joined relative for apply_patch)
    const fp = request.metadata?.filepath
    if (typeof fp === "string") {
      // apply_patch joins relative paths with ", "
      const parts = fp.includes(", ") ? fp.split(", ") : [fp]
      for (const part of parts) {
        if (path.isAbsolute(part) ? isAbsolute(part) : isRelative(part)) return true
      }
    }

    // Check metadata.files[] (apply_patch file objects with absolute filePath)
    const files = request.metadata?.files
    if (Array.isArray(files)) {
      for (const file of files) {
        if (typeof file?.filePath === "string" && isAbsolute(file.filePath)) return true
      }
    }

    return false
  }
}
