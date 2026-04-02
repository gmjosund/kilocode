import { useDialog } from "@tui/ui/dialog"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import path from "path"
import { createMemo, createSignal, createResource, onMount, Show } from "solid-js"
import { Locale } from "@/util/locale"
import { useKeybind } from "../context/keybind"
import { useTheme } from "../context/theme"
import { useSDK } from "../context/sdk"
import { DialogSessionRename } from "./dialog-session-rename"
import { createDebouncedSignal } from "../util/signal"
import { Spinner } from "./spinner"
import { useToast } from "../ui/toast"

export function DialogSessionList() {
  const dialog = useDialog()
  const route = useRoute()
  const sync = useSync()
  const keybind = useKeybind()
  const { theme } = useTheme()
  const sdk = useSDK()
  const toast = useToast()

  const [toDelete, setToDelete] = createSignal<string>()
  const [search, setSearch] = createDebouncedSignal("", 150)
  const [global, setGlobal] = createSignal(false) // kilocode_change

  // kilocode_change start
  const [searchResults] = createResource(
    () => ({ query: search(), global: global() }),
    async ({ query, global: all }) => {
      if (!query && !all) return undefined
      if (all) {
        const result = await sdk.client.experimental.session.list({
          search: query || undefined,
          roots: true,
          limit: 30,
        })
        return result.data ?? []
      }
      const result = await sdk.client.session.list({ search: query, limit: 30 })
      return result.data ?? []
    },
  )
  // kilocode_change end

  const currentSessionID = createMemo(() => (route.data.type === "session" ? route.data.sessionID : undefined))

  const sessions = createMemo(() => searchResults() ?? sync.data.session)

  const options = createMemo(() => {
    const today = new Date().toDateString()
    const all = global() // kilocode_change
    return sessions()
      .filter((x) => x.parentID === undefined)
      .toSorted((a, b) => b.time.updated - a.time.updated)
      .map((x) => {
        const date = new Date(x.time.updated)
        let category = date.toDateString()
        if (category === today) {
          category = "Today"
        }
        const isDeleting = toDelete() === x.id
        const status = sync.data.session_status?.[x.id]
        const isWorking = status?.type === "busy"
        // kilocode_change start
        const project =
          all && "project" in x ? (x as { project?: { name?: string; worktree: string } | null }).project : undefined
        const root = project?.name ?? (project ? path.basename(project.worktree) || project.worktree : "")
        const suffix = root ? ` [${root}]` : ""
        // kilocode_change end
        return {
          title: isDeleting ? `Press ${keybind.print("session_delete")} again to confirm` : x.title + suffix, // kilocode_change
          bg: isDeleting ? theme.error : undefined,
          value: x.id,
          category,
          footer: Locale.time(x.time.updated),
          gutter: isWorking ? <Spinner /> : undefined,
        }
      })
  })

  onMount(() => {
    dialog.setSize("large")
  })

  return (
    <DialogSelect
      title={global() ? "Sessions (all projects)" : "Sessions"}
      options={options()}
      skipFilter={true}
      current={currentSessionID()}
      onFilter={setSearch}
      onMove={() => {
        setToDelete(undefined)
      }}
      onSelect={(option) => {
        const item = sessions().find((x) => x.id === option.value)
        const cross =
          global() &&
          item &&
          "project" in item &&
          item.project?.worktree !== undefined &&
          item.project.worktree !== sync.data.path.worktree
        if (cross) {
          toast.show({
            message: "Open this session from its own project",
            variant: "error",
          })
          return
        }
        route.navigate({
          type: "session",
          sessionID: option.value,
        })
        dialog.clear()
      }}
      keybind={[
        {
          keybind: keybind.all.session_delete?.[0],
          title: "delete",
          // kilocode_change start
          disabled: global(),
          // kilocode_change end
          onTrigger: async (option) => {
            if (global()) return // kilocode_change
            if (toDelete() === option.value) {
              sdk.client.session.delete({
                sessionID: option.value,
              })
              setToDelete(undefined)
              return
            }
            setToDelete(option.value)
          },
        },
        {
          keybind: keybind.all.session_rename?.[0],
          title: "rename",
          // kilocode_change start
          disabled: global(),
          // kilocode_change end
          onTrigger: async (option) => {
            if (global()) return // kilocode_change
            dialog.replace(() => <DialogSessionRename session={option.value} />)
          },
        },
        // kilocode_change start
        {
          keybind: { name: "a", ctrl: true, meta: false, shift: false, leader: false },
          title: global() ? "project" : "all",
          onTrigger: async () => {
            setGlobal((v) => !v)
          },
        },
        // kilocode_change end
      ]}
    />
  )
}
