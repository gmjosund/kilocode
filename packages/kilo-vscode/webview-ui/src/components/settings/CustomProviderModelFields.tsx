import { Collapsible } from "@kilocode/kilo-ui/collapsible"
import { IconButton } from "@kilocode/kilo-ui/icon-button"
import { TextField } from "@kilocode/kilo-ui/text-field"
import type { Component } from "solid-js"
import type { FormErrors, ModelRow } from "./custom-provider-form"

type Props = {
  model: ModelRow
  errors: FormErrors["models"][number]
  count: number
  t: (key: string) => string
  defaults: {
    context: string
    output: string
    inputPrice: string
    outputPrice: string
  }
  onChange: <K extends keyof ModelRow>(key: K, value: ModelRow[K]) => void
  onRemove: () => void
}

function grid() {
  return { display: "grid", gap: "8px", "grid-template-columns": "repeat(2, minmax(0, 1fr))" }
}

export const CustomProviderModelFields: Component<Props> = (props) => {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: "12px",
        padding: "12px",
        border: "1px solid var(--border-weak-base, var(--vscode-panel-border))",
        "border-radius": "8px",
      }}
    >
      <div style={{ display: "flex", gap: "8px", "align-items": "start" }}>
        <div style={{ flex: 1 }}>
          <TextField
            label={props.t("provider.custom.models.id.label")}
            hideLabel
            placeholder={props.t("provider.custom.models.id.placeholder")}
            value={props.model.id}
            onChange={(value) => props.onChange("id", value)}
            validationState={props.errors?.id ? "invalid" : undefined}
            error={props.errors?.id}
          />
        </div>
        <div style={{ flex: 1 }}>
          <TextField
            label={props.t("provider.custom.models.name.label")}
            hideLabel
            placeholder={props.t("provider.custom.models.name.placeholder")}
            value={props.model.name}
            onChange={(value) => props.onChange("name", value)}
            validationState={props.errors?.name ? "invalid" : undefined}
            error={props.errors?.name}
          />
        </div>
        <IconButton
          type="button"
          icon="trash"
          variant="ghost"
          onClick={props.onRemove}
          disabled={props.count <= 1}
          aria-label={props.t("provider.custom.models.remove")}
          style={{ "margin-top": "6px" }}
        />
      </div>

      <Collapsible open={props.model.open} onOpenChange={(value) => props.onChange("open", value)} variant="ghost">
        <Collapsible.Trigger>
          <div
            style={{
              display: "flex",
              "justify-content": "space-between",
              "align-items": "center",
              color: "var(--text-weak-base)",
              "font-size": "12px",
              "font-weight": "500",
            }}
          >
            <span>{props.t("provider.custom.models.advanced.label")}</span>
            <Collapsible.Arrow />
          </div>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div style={{ display: "flex", "flex-direction": "column", gap: "12px", "margin-top": "12px" }}>
            <div style={grid()}>
              <TextField
                label={props.t("provider.custom.models.context.label")}
                placeholder={props.defaults.context}
                value={props.model.context}
                onChange={(value) => props.onChange("context", value)}
                validationState={props.errors?.context ? "invalid" : undefined}
                error={props.errors?.context}
              />
              <TextField
                label={props.t("provider.custom.models.output.label")}
                placeholder={props.defaults.output}
                value={props.model.output}
                onChange={(value) => props.onChange("output", value)}
                validationState={props.errors?.output ? "invalid" : undefined}
                error={props.errors?.output}
              />
            </div>
            <div style={grid()}>
              <TextField
                label={props.t("provider.custom.models.inputLimit.label")}
                placeholder={props.t("provider.custom.models.optional.placeholder")}
                description={props.t("provider.custom.models.optional.description")}
                value={props.model.input}
                onChange={(value) => props.onChange("input", value)}
                validationState={props.errors?.input ? "invalid" : undefined}
                error={props.errors?.input}
              />
              <TextField
                label={props.t("provider.custom.models.inputPrice.label")}
                placeholder={props.defaults.inputPrice}
                description={props.t("provider.custom.models.price.unit")}
                value={props.model.inputPrice}
                onChange={(value) => props.onChange("inputPrice", value)}
                validationState={props.errors?.inputPrice ? "invalid" : undefined}
                error={props.errors?.inputPrice}
              />
              <TextField
                label={props.t("provider.custom.models.outputPrice.label")}
                placeholder={props.defaults.outputPrice}
                description={props.t("provider.custom.models.price.unit")}
                value={props.model.outputPrice}
                onChange={(value) => props.onChange("outputPrice", value)}
                validationState={props.errors?.outputPrice ? "invalid" : undefined}
                error={props.errors?.outputPrice}
              />
            </div>
            <div style={grid()}>
              <TextField
                label={props.t("provider.custom.models.cacheRead.label")}
                placeholder={props.t("provider.custom.models.optional.placeholder")}
                description={props.t("provider.custom.models.price.unit")}
                value={props.model.cacheRead}
                onChange={(value) => props.onChange("cacheRead", value)}
                validationState={props.errors?.cacheRead ? "invalid" : undefined}
                error={props.errors?.cacheRead}
              />
              <TextField
                label={props.t("provider.custom.models.cacheWrite.label")}
                placeholder={props.t("provider.custom.models.optional.placeholder")}
                description={props.t("provider.custom.models.price.unit")}
                value={props.model.cacheWrite}
                onChange={(value) => props.onChange("cacheWrite", value)}
                validationState={props.errors?.cacheWrite ? "invalid" : undefined}
                error={props.errors?.cacheWrite}
              />
            </div>
          </div>
        </Collapsible.Content>
      </Collapsible>
    </div>
  )
}
