import { test, expect, describe } from "bun:test"
import path from "path"
import { ConfigProtection } from "../../../src/kilocode/permission/config-paths"
import { Global } from "../../../src/global"
import { KilocodePaths } from "../../../src/kilocode/paths"

describe("ConfigProtection.isRelative", () => {
  test("protects .kilo/ config files", () => {
    expect(ConfigProtection.isRelative(".kilo/config.json")).toBe(true)
    expect(ConfigProtection.isRelative(".kilo/agent/foo.md")).toBe(true)
  })

  test("excludes plans/ under .kilo/", () => {
    expect(ConfigProtection.isRelative(".kilo/plans/my-plan.md")).toBe(false)
    expect(ConfigProtection.isRelative(".kilo/plans/12345-slug.md")).toBe(false)
  })

  test("excludes nested plans/ under config dirs", () => {
    expect(ConfigProtection.isRelative("packages/sub/.kilo/plans/plan.md")).toBe(false)
    expect(ConfigProtection.isRelative("packages/sub/.opencode/plans/plan.md")).toBe(false)
  })

  test("protects root config files", () => {
    expect(ConfigProtection.isRelative("kilo.json")).toBe(true)
    expect(ConfigProtection.isRelative("AGENTS.md")).toBe(true)
  })

  test("does not protect non-config files", () => {
    expect(ConfigProtection.isRelative("src/index.ts")).toBe(false)
    expect(ConfigProtection.isRelative("README.md")).toBe(false)
  })
})

describe("ConfigProtection.isAbsolute", () => {
  test("protects files under XDG config dir", () => {
    const cfg = path.join(Global.Path.config, "config.json")
    expect(ConfigProtection.isAbsolute(cfg)).toBe(true)
  })

  test("protects files under ~/.kilo/", () => {
    for (const dir of KilocodePaths.globalDirs()) {
      const cfg = path.join(dir, "config.json")
      expect(ConfigProtection.isAbsolute(cfg)).toBe(true)
    }
  })

  test("excludes plans/ under XDG config dir", () => {
    const plan = path.join(Global.Path.config, "plans", "my-plan.md")
    expect(ConfigProtection.isAbsolute(plan)).toBe(false)
  })

  test("excludes plans/ under ~/.kilo/", () => {
    for (const dir of KilocodePaths.globalDirs()) {
      const plan = path.join(dir, "plans", "12345-slug.md")
      expect(ConfigProtection.isAbsolute(plan)).toBe(false)
    }
  })

  test("does not protect unrelated absolute paths", () => {
    expect(ConfigProtection.isAbsolute("/tmp/random/file.txt")).toBe(false)
    expect(ConfigProtection.isAbsolute("/home/user/project/src/index.ts")).toBe(false)
  })
})

describe("ConfigProtection.isRequest", () => {
  test("flags edit requests for config files", () => {
    expect(
      ConfigProtection.isRequest({
        permission: "edit",
        patterns: [".kilo/config.json"],
      }),
    ).toBe(true)
  })

  test("does not flag edit requests for plan files (relative)", () => {
    expect(
      ConfigProtection.isRequest({
        permission: "edit",
        patterns: [".kilo/plans/my-plan.md"],
      }),
    ).toBe(false)
  })

  test("does not flag edit requests for plan files (absolute)", () => {
    for (const dir of KilocodePaths.globalDirs()) {
      expect(
        ConfigProtection.isRequest({
          permission: "edit",
          patterns: [path.join(dir, "plans", "12345-slug.md")],
        }),
      ).toBe(false)
    }
  })

  test("flags external_directory for global config dirs", () => {
    expect(
      ConfigProtection.isRequest({
        permission: "external_directory",
        patterns: [Global.Path.config + "/*"],
      }),
    ).toBe(true)
  })

  test("does not flag read permission", () => {
    expect(
      ConfigProtection.isRequest({
        permission: "read",
        patterns: [".kilo/config.json"],
      }),
    ).toBe(false)
  })
})
