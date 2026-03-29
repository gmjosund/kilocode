export interface ProjectInfo {
  id: string
  name?: string
  worktree: string
}

export interface SessionInfo {
  id: string
  slug: string
  projectID: string
  workspaceID?: string
  directory: string
  parentID?: string
  title: string
  version: string
  time: {
    created: number
    updated: number
    compacting?: number
    archived?: number
  }
}

export interface UserMessage {
  id: string
  sessionID: string
  role: "user"
  time: {
    created: number
  }
  agent: string
  model: {
    providerID: string
    modelID: string
  }
  tools?: Record<string, boolean>
}

export interface AssistantMessage {
  id: string
  sessionID: string
  role: "assistant"
  time: {
    created: number
    completed?: number
  }
  parentID: string
  modelID: string
  providerID: string
  mode: string
  agent: string
  path: {
    cwd: string
    root: string
  }
  summary?: boolean
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
    total?: number
  }
}

export type MessageInfo = UserMessage | AssistantMessage

export interface TextPart {
  id: string
  sessionID: string
  messageID: string
  type: "text"
  text: string
  synthetic?: boolean
  ignored?: boolean
  time?: {
    start: number
    end?: number
  }
  metadata?: Record<string, unknown>
}

export interface ReasoningPart {
  id: string
  sessionID: string
  messageID: string
  type: "reasoning"
  text: string
  metadata?: Record<string, unknown>
  time: {
    start: number
    end?: number
  }
}

export interface ToolPart {
  id: string
  sessionID: string
  messageID: string
  type: "tool"
  callID: string
  tool: string
  state:
    | {
        status: "pending"
        input: Record<string, unknown>
        raw: string
      }
    | {
        status: "running"
        input: Record<string, unknown>
        title?: string
        metadata?: Record<string, unknown>
        time: {
          start: number
        }
      }
    | {
        status: "completed"
        input: Record<string, unknown>
        output: string
        title: string
        metadata: Record<string, unknown>
        time: {
          start: number
          end: number
          compacted?: number
        }
        attachments?: unknown[]
      }
    | {
        status: "error"
        input: Record<string, unknown>
        error: string
        metadata?: Record<string, unknown>
        time: {
          start: number
          end: number
        }
      }
  metadata?: Record<string, unknown>
}

export type Part = TextPart | ReasoningPart | ToolPart

export interface Message {
  info: MessageInfo
  parts: Part[]
}

export interface SessionImport {
  project: ProjectInfo
  session: SessionInfo
  messages: Message[]
}
