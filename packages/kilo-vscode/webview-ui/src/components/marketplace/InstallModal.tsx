import { Component, Show, For, createSignal, createMemo, createEffect, onCleanup } from "solid-js"
import { Dialog } from "@kilocode/kilo-ui/dialog"
import { Button } from "@kilocode/kilo-ui/button"
import { TextField } from "@kilocode/kilo-ui/text-field"
import { Select } from "@kilocode/kilo-ui/select"
import { RadioGroup } from "@kilocode/kilo-ui/radio-group"
import { Icon } from "@kilocode/kilo-ui/icon"
import { useVSCode } from "../../context/vscode"
import { useServer } from "../../context/server"
import { useLanguage } from "../../context/language"
import type { MarketplaceItem, McpInstallationMethod, McpParameter, McpMarketplaceItem } from "../../types/marketplace"
import type { ExtensionMessage } from "../../types/messages"

interface InstallModalProps {
  item: MarketplaceItem
  onClose: () => void
  onInstallResult?: (result: { success: boolean; slug: string; scope: "project" | "global"; error?: string }) => void
}

type Scope = "project" | "global"

const SCOPES: Scope[] = ["project", "global"]

export const InstallModal: Component<InstallModalProps> = (props) => {
  const vscode = useVSCode()
  const server = useServer()
  const { t } = useLanguage()

  const [scope, setScope] = createSignal<Scope>(server.workspaceDirectory() ? "project" : "global")
  const [selected, setSelected] = createSignal(0)
  const [params, setParams] = createSignal<Record<string, string>>({})
  const [errors, setErrors] = createSignal<Record<string, string>>({})
  const [installing, setInstalling] = createSignal(false)
  const [result, setResult] = createSignal<{ success: boolean; slug: string; error?: string } | null>(null)

  const workspace = createMemo(() => !!server.workspaceDirectory())

  // Listen for install result messages
  createEffect(() => {
    const unsubscribe = vscode.onMessage((msg: ExtensionMessage) => {
      if (msg.type !== "marketplaceInstallResult") return
      if (msg.slug !== props.item.id) return
      const r = { success: msg.success, slug: msg.slug, scope: scope(), error: msg.error }
      setResult(r)
      setInstalling(false)
      props.onInstallResult?.(r)
    })

    onCleanup(unsubscribe)
  })

  const methods = createMemo((): McpInstallationMethod[] => {
    if (props.item.type !== "mcp") return []
    if (!Array.isArray(props.item.content)) return []
    return props.item.content
  })

  const prerequisites = createMemo((): string[] => {
    const global = props.item.prerequisites ?? []
    if (props.item.type !== "mcp" || !Array.isArray(props.item.content)) return global
    const method = props.item.content[selected()]
    if (!method) return global
    const local = method.prerequisites ?? []
    return [...new Set([...global, ...local])]
  })

  const parameters = createMemo((): McpParameter[] => {
    if (props.item.type !== "mcp") return []
    const mcp = props.item as McpMarketplaceItem
    if (!Array.isArray(mcp.content)) return mcp.parameters ?? []
    const global = mcp.parameters ?? []
    const method = mcp.content[selected()]
    if (!method) return global
    const local = method.parameters ?? []
    const map = new Map<string, McpParameter>()
    for (const p of global) map.set(p.key, p)
    for (const p of local) map.set(p.key, p)
    return [...map.values()]
  })

  const handleInstall = () => {
    if (installing()) return

    const validation: Record<string, string> = {}
    for (const p of parameters()) {
      if (p.optional) continue
      if (!(params()[p.key] ?? "").trim()) {
        validation[p.key] = t("marketplace.install.required", { name: p.name })
      }
    }
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    setInstalling(true)

    const options = {
      target: scope(),
      parameters: {
        ...params(),
        ...(props.item.type === "mcp" && Array.isArray(props.item.content) ? { _selectedIndex: selected() } : {}),
      },
    }

    vscode.postMessage({
      type: "installMarketplaceItem",
      mpItem: props.item,
      mpInstallOptions: options,
    })
  }

  const scopeLabel = (s: Scope) => (s === "project" ? t("marketplace.scope.project") : t("marketplace.scope.global"))

  const availableScopes = createMemo(() => (workspace() ? SCOPES : SCOPES.filter((s) => s === "global")))

  return (
    <Dialog title={t("marketplace.install.title", { name: props.item.name })} fit>
      <Show when={!result()}>
        <div class="install-modal-body">
          {/* Scope Selection */}
          <div class="install-modal-section">
            <span class="install-modal-label">{t("marketplace.install.scope")}</span>
            <RadioGroup
              options={availableScopes()}
              current={scope()}
              onSelect={(v) => v && setScope(v)}
              label={scopeLabel}
              value={(s) => s}
              size="small"
            />
          </div>

          {/* Installation Method (MCP with array content only) */}
          <Show when={props.item.type === "mcp" && methods().length > 0}>
            <div class="install-modal-section">
              <span class="install-modal-label">{t("marketplace.install.method")}</span>
              <Select
                options={methods()}
                current={methods()[selected()]}
                onSelect={(m) => m && setSelected(methods().indexOf(m))}
                label={(m) => m.name}
                value={(m) => m.name}
                variant="secondary"
              />
            </div>
          </Show>

          {/* Prerequisites */}
          <Show when={prerequisites().length > 0}>
            <div class="install-modal-section">
              <span class="install-modal-label">{t("marketplace.install.prerequisites")}</span>
              <ul class="install-modal-prerequisites">
                <For each={prerequisites()}>{(prereq) => <li>{prereq}</li>}</For>
              </ul>
            </div>
          </Show>

          {/* Parameters */}
          <Show when={parameters().length > 0}>
            <div class="install-modal-section">
              <span class="install-modal-label">{t("marketplace.install.parameters")}</span>
              <For each={parameters()}>
                {(param) => (
                  <div class="install-modal-param">
                    <TextField
                      label={param.name + (param.optional ? ` ${t("marketplace.install.optional")}` : "")}
                      placeholder={param.placeholder ?? ""}
                      value={params()[param.key] ?? ""}
                      onChange={(v) => setParams((p) => ({ ...p, [param.key]: v }))}
                      error={errors()[param.key]}
                    />
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="install-modal-footer">
          <Button variant="secondary" onClick={props.onClose}>
            {t("marketplace.cancel")}
          </Button>
          <Button variant="primary" onClick={handleInstall} disabled={installing()}>
            {installing() ? t("marketplace.install.installing") : t("marketplace.install")}
          </Button>
        </div>
      </Show>

      {/* Success State */}
      <Show when={result()?.success}>
        <div class="install-modal-result">
          <div class="install-modal-success">
            <Icon name="check-small" />
            <span>{t("marketplace.installed")}</span>
          </div>
          <div class="install-modal-footer">
            <Button variant="primary" onClick={props.onClose}>
              {t("marketplace.install.done")}
            </Button>
          </div>
        </div>
      </Show>

      {/* Error State */}
      <Show when={result() && !result()!.success}>
        <div class="install-modal-result">
          <div class="install-modal-error-msg">{result()!.error ?? t("marketplace.install.failed")}</div>
          <div class="install-modal-footer">
            <Button variant="secondary" onClick={props.onClose}>
              {t("marketplace.close")}
            </Button>
          </div>
        </div>
      </Show>
    </Dialog>
  )
}
