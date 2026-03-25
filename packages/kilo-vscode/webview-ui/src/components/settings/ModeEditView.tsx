import { Component, Show, createMemo, createSignal } from "solid-js"
import { TextField } from "@kilocode/kilo-ui/text-field"
import { Card } from "@kilocode/kilo-ui/card"
import { Button } from "@kilocode/kilo-ui/button"
import { IconButton } from "@kilocode/kilo-ui/icon-button"
import { Dialog } from "@kilocode/kilo-ui/dialog"
import { useDialog } from "@kilocode/kilo-ui/context/dialog"

import { useConfig } from "../../context/config"
import { useSession } from "../../context/session"
import { useLanguage } from "../../context/language"
import type { AgentConfig, AgentInfo } from "../../types/messages"
import SettingsRow from "./SettingsRow"

interface Props {
  name: string
  onBack: () => void
  onRemove: (agent: AgentInfo) => void
}

const ModeEditView: Component<Props> = (props) => {
  const language = useLanguage()
  const { config, updateConfig } = useConfig()
  const session = useSession()
  const dialog = useDialog()
  const [copied, setCopied] = createSignal(false)

  // agent() may be undefined for modes that only exist in the config draft (just
  // created, not yet saved). This is fine — native defaults to false (correct for
  // custom modes) and all fields read from cfg() which comes from config context.
  const agent = () => session.agents().find((a) => a.name === props.name)
  const native = () => agent()?.native ?? false

  const cfg = createMemo<AgentConfig>(() => config().agent?.[props.name] ?? {})

  const update = (partial: Partial<AgentConfig>) => {
    const existing = config().agent ?? {}
    const current = existing[props.name] ?? {}
    updateConfig({
      agent: {
        ...existing,
        [props.name]: { ...current, ...partial },
      },
    })
  }

  const prompt = () => cfg().prompt ?? ""

  const copy = () => {
    const text = prompt()
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const preview = () => {
    const text = prompt()
    dialog.show(() => (
      <Dialog title={language.t("settings.agentBehaviour.editMode.promptPreview.title")} fit>
        <div style={{ "max-height": "400px", overflow: "auto" }}>
          <pre
            style={{
              "font-family": "var(--vscode-editor-font-family, monospace)",
              "font-size": "12px",
              "white-space": "pre-wrap",
              "word-break": "break-word",
              margin: 0,
              "line-height": "1.5",
              color: "var(--vscode-foreground)",
            }}
          >
            {text || language.t("settings.agentBehaviour.editMode.promptPreview.empty")}
          </pre>
        </div>
        <div style={{ display: "flex", "justify-content": "flex-end", "margin-top": "12px", gap: "8px" }}>
          <Button variant="ghost" size="large" onClick={() => dialog.close()}>
            {language.t("common.close")}
          </Button>
          <Show when={text}>
            <Button
              variant="secondary"
              size="large"
              onClick={() => {
                navigator.clipboard.writeText(text)
              }}
            >
              {language.t("settings.agentBehaviour.editMode.promptPreview.copy")}
            </Button>
          </Show>
        </div>
      </Dialog>
    ))
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "margin-bottom": "16px",
        }}
      >
        <div style={{ display: "flex", "align-items": "center" }}>
          <IconButton size="small" variant="ghost" icon="arrow-left" onClick={props.onBack} />
          <span style={{ "font-weight": "600", "font-size": "14px", "margin-left": "8px" }}>
            {language.t("settings.agentBehaviour.editMode")} — {props.name}
          </span>
        </div>
        <Show when={!native()}>
          <IconButton
            size="small"
            variant="ghost"
            icon="close"
            onClick={() => {
              const a = agent()
              if (a) props.onRemove(a)
            }}
          />
        </Show>
      </div>

      <Show when={native()}>
        <Card style={{ "margin-bottom": "12px" }}>
          <div
            style={{
              "font-size": "12px",
              color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
              padding: "4px 0",
            }}
          >
            {language.t("settings.agentBehaviour.editMode.native")}
          </div>
        </Card>
      </Show>

      {/* Description (full-width, custom modes only) */}
      <Show when={!native()}>
        <Card style={{ "margin-bottom": "12px" }}>
          <div data-slot="settings-row-label-title" style={{ "margin-bottom": "8px" }}>
            {language.t("settings.agentBehaviour.editMode.description")}
          </div>
          <TextField
            value={cfg().description ?? ""}
            placeholder={language.t("settings.agentBehaviour.createMode.description.placeholder")}
            onChange={(val) => update({ description: val || undefined })}
          />
        </Card>
      </Show>

      {/* Prompt (full-width, auto-resizing) */}
      <Card style={{ "margin-bottom": "12px" }}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            "margin-bottom": "8px",
          }}
        >
          <div data-slot="settings-row-label-title">
            {native()
              ? language.t("settings.agentBehaviour.editMode.promptOverride")
              : language.t("settings.agentBehaviour.editMode.prompt")}
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <IconButton
              size="small"
              variant="ghost"
              icon="eye"
              title={language.t("settings.agentBehaviour.editMode.promptPreview.title")}
              onClick={preview}
            />
            <IconButton
              size="small"
              variant="ghost"
              icon="copy"
              title={
                copied()
                  ? language.t("settings.agentBehaviour.editMode.promptCopied")
                  : language.t("settings.agentBehaviour.editMode.promptCopy")
              }
              onClick={copy}
            />
          </div>
        </div>
        <TextField
          value={cfg().prompt ?? ""}
          placeholder={language.t("settings.agentBehaviour.createMode.prompt.placeholder")}
          multiline
          onChange={(val) => update({ prompt: val || undefined })}
        />
      </Card>

      {/* Config overrides (wider inputs) */}
      <Card data-variant="wide-input" style={{ "margin-bottom": "12px" }}>
        <SettingsRow
          title={language.t("settings.agentBehaviour.modelOverride.title")}
          description={language.t("settings.agentBehaviour.modelOverride.description")}
        >
          <TextField
            value={cfg().model ?? ""}
            placeholder="e.g. anthropic/claude-sonnet-4-20250514"
            onChange={(val) => update({ model: val || undefined })}
          />
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.agentBehaviour.temperature.title")}
          description={language.t("settings.agentBehaviour.temperature.description")}
        >
          <TextField
            value={cfg().temperature?.toString() ?? ""}
            placeholder={language.t("common.default")}
            onChange={(val) => {
              const parsed = parseFloat(val)
              update({ temperature: isNaN(parsed) ? undefined : parsed })
            }}
          />
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.agentBehaviour.topP.title")}
          description={language.t("settings.agentBehaviour.topP.description")}
        >
          <TextField
            value={cfg().top_p?.toString() ?? ""}
            placeholder={language.t("common.default")}
            onChange={(val) => {
              const parsed = parseFloat(val)
              update({ top_p: isNaN(parsed) ? undefined : parsed })
            }}
          />
        </SettingsRow>

        <SettingsRow
          title={language.t("settings.agentBehaviour.maxSteps.title")}
          description={language.t("settings.agentBehaviour.maxSteps.description")}
          last
        >
          <TextField
            value={cfg().steps?.toString() ?? ""}
            placeholder={language.t("common.default")}
            onChange={(val) => {
              const parsed = parseInt(val, 10)
              update({ steps: isNaN(parsed) ? undefined : parsed })
            }}
          />
        </SettingsRow>
      </Card>

      <div style={{ display: "flex", "justify-content": "flex-end" }}>
        <Button variant="ghost" onClick={props.onBack}>
          {language.t("settings.agentBehaviour.editMode.back")}
        </Button>
      </div>
    </div>
  )
}

export default ModeEditView
