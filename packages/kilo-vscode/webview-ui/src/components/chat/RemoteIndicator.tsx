import { createSignal, onMount, onCleanup, Show } from "solid-js"
import { Tooltip } from "@kilocode/kilo-ui/tooltip"
import { showToast } from "@kilocode/kilo-ui/toast"
import { useVSCode } from "../../context/vscode"
import { useLanguage } from "../../context/language"
import type { ExtensionMessage } from "../../types/messages"

export function RemoteIndicator() {
  const vscode = useVSCode()
  const language = useLanguage()
  const [status, setStatus] = createSignal<{ enabled: boolean; connected: boolean } | null>(null)

  const handler = (msg: ExtensionMessage) => {
    if (msg.type === "remoteStatus") {
      setStatus({ enabled: msg.enabled, connected: msg.connected })
    }
    if (msg.type === "remoteToggled") {
      setStatus({ enabled: msg.enabled, connected: msg.connected })
      showToast({
        title: msg.enabled ? language.t("remote.toast.enabled") : language.t("remote.toast.disabled"),
        variant: "success",
      })
    }
  }

  onMount(() => {
    const unsub = vscode.onMessage(handler)
    vscode.postMessage({ type: "requestRemoteStatus" })
    const timer = setInterval(() => {
      vscode.postMessage({ type: "requestRemoteStatus" })
    }, 5000)
    onCleanup(() => {
      unsub()
      clearInterval(timer)
    })
  })

  return (
    <Show when={status()?.enabled}>
      <Tooltip
        value={status()?.connected ? language.t("remote.status.connected") : language.t("remote.status.connecting")}
        placement="top"
      >
        <span class="remote-indicator" data-connected={status()?.connected}>
          ◆ {language.t("remote.indicator")}
          {!status()?.connected && " …"}
        </span>
      </Tooltip>
    </Show>
  )
}
