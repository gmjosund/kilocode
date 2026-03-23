import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"

// Mock vscode following the pattern from AutocompleteServiceManager.spec.ts
vi.mock("vscode", () => {
  const disposable = { dispose: vi.fn() }

  return {
    commands: {
      registerCommand: vi.fn((_command: string, _callback: (...args: any[]) => any) => disposable),
    },
    window: {
      showErrorMessage: vi.fn(),
      withProgress: vi.fn(),
      activeTextEditor: undefined as any,
    },
    workspace: {
      workspaceFolders: [
        {
          uri: { fsPath: "/test/workspace" },
        },
      ],
    },
    extensions: {
      getExtension: vi.fn(),
    },
    ProgressLocation: {
      SourceControl: 1,
    },
    Uri: {
      parse: (s: string) => ({ fsPath: s }),
    },
  }
})

import * as vscode from "vscode"
import { registerCommitMessageService } from "../index"
import type { KiloConnectionService } from "../../cli-backend/connection-service"

function makeRepo(path: string) {
  return { inputBox: { value: "" }, rootUri: { fsPath: path } }
}

function makeGitAPI(repos: ReturnType<typeof makeRepo>[]) {
  return {
    repositories: repos,
    getRepository: (uri: { fsPath: string }) => repos.find((r) => uri.fsPath.startsWith(r.rootUri.fsPath)) ?? null,
  }
}

function makeGitExtension(api: ReturnType<typeof makeGitAPI>) {
  return {
    isActive: true,
    activate: vi.fn().mockResolvedValue(undefined),
    exports: { getAPI: () => api },
  } as any
}

describe("commit-message service", () => {
  let mockContext: vscode.ExtensionContext
  let mockConnectionService: KiloConnectionService
  let mockClient: { commitMessage: { generate: Mock } }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(vscode.window as any).activeTextEditor = undefined

    mockContext = {
      subscriptions: [],
    } as any

    mockClient = {
      commitMessage: {
        generate: vi.fn().mockResolvedValue({ data: { message: "feat: add new feature" } }),
      },
    }

    mockConnectionService = {
      getClient: vi.fn().mockReturnValue(mockClient),
    } as any
  })

  describe("registerCommitMessageService", () => {
    it("returns an array of disposables", () => {
      const disposables = registerCommitMessageService(mockContext, mockConnectionService)

      expect(Array.isArray(disposables)).toBe(true)
      expect(disposables.length).toBeGreaterThan(0)
    })

    it("registers the kilo-code.new.generateCommitMessage command", () => {
      registerCommitMessageService(mockContext, mockConnectionService)

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "kilo-code.new.generateCommitMessage",
        expect.any(Function),
      )
    })

    it("pushes the command disposable to context.subscriptions", () => {
      registerCommitMessageService(mockContext, mockConnectionService)

      expect(mockContext.subscriptions.length).toBe(1)
    })
  })

  describe("command execution", () => {
    let commandCallback: (...args: any[]) => Promise<void>

    beforeEach(() => {
      registerCommitMessageService(mockContext, mockConnectionService)

      // Extract the registered command callback
      const registerCall = (vscode.commands.registerCommand as Mock).mock.calls[0]!
      commandCallback = registerCall[1] as (...args: any[]) => Promise<void>
    })

    it("shows error when git extension is not found", async () => {
      ;(vscode.extensions.getExtension as Mock).mockReturnValue(undefined)

      await commandCallback()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Git extension not found")
    })

    it("shows error when no git repository is found", async () => {
      ;(vscode.extensions.getExtension as Mock).mockReturnValue(makeGitExtension(makeGitAPI([])))

      await commandCallback()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No Git repository found")
    })

    it("shows error when backend is not connected", async () => {
      const repo = makeRepo("/repo")
      ;(vscode.extensions.getExtension as Mock).mockReturnValue(makeGitExtension(makeGitAPI([repo])))
      ;(mockConnectionService.getClient as Mock).mockImplementation(() => {
        throw new Error("Not connected")
      })

      await commandCallback()

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Kilo backend is not connected. Please wait for the connection to establish.",
      )
    })

    it("uses the first repository when no SCM arg or active editor", async () => {
      const repo = makeRepo("/repo")
      ;(vscode.extensions.getExtension as Mock).mockReturnValue(makeGitExtension(makeGitAPI([repo])))
      ;(vscode.window.withProgress as Mock).mockImplementation(async (_options: any, task: any) => {
        await task({} as any, {} as any)
      })

      await commandCallback()

      expect(mockClient.commitMessage.generate).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/repo" }),
        expect.anything(),
      )
    })

    it("resolves repository from SCM arg rootUri", async () => {
      const main = makeRepo("/main-repo")
      const worktree = makeRepo("/worktree")
      ;(vscode.extensions.getExtension as Mock).mockReturnValue(makeGitExtension(makeGitAPI([main, worktree])))
      ;(vscode.window.withProgress as Mock).mockImplementation(async (_options: any, task: any) => {
        await task({} as any, {} as any)
      })

      // Simulate SCM arg with rootUri pointing to the worktree
      await commandCallback({ rootUri: { fsPath: "/worktree" } })

      expect(mockClient.commitMessage.generate).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/worktree" }),
        expect.anything(),
      )
    })

    it("resolves repository from active text editor when no SCM arg", async () => {
      const main = makeRepo("/main-repo")
      const worktree = makeRepo("/worktree")
      ;(vscode.extensions.getExtension as Mock).mockReturnValue(makeGitExtension(makeGitAPI([main, worktree])))
      ;(vscode.window as any).activeTextEditor = {
        document: { uri: { scheme: "file", fsPath: "/worktree/src/index.ts" } },
      }
      ;(vscode.window.withProgress as Mock).mockImplementation(async (_options: any, task: any) => {
        await task({} as any, {} as any)
      })

      await commandCallback()

      expect(mockClient.commitMessage.generate).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/worktree" }),
        expect.anything(),
      )
    })

    it("sets the generated message on the repository inputBox", async () => {
      const repo = makeRepo("/repo")
      ;(vscode.extensions.getExtension as Mock).mockReturnValue(makeGitExtension(makeGitAPI([repo])))
      ;(vscode.window.withProgress as Mock).mockImplementation(async (_options: any, task: any) => {
        await task({} as any, {} as any)
      })

      await commandCallback()

      expect(repo.inputBox.value).toBe("feat: add new feature")
    })

    it("shows progress in SourceControl location", async () => {
      const repo = makeRepo("/repo")
      ;(vscode.extensions.getExtension as Mock).mockReturnValue(makeGitExtension(makeGitAPI([repo])))
      ;(vscode.window.withProgress as Mock).mockImplementation(async (_options: any, task: any) => {
        await task({} as any, {} as any)
      })

      await commandCallback()

      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          location: vscode.ProgressLocation.SourceControl,
          title: "Generating commit message...",
        }),
        expect.any(Function),
      )
    })
  })
})
