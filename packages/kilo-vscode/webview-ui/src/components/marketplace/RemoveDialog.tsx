import { Component, createMemo } from "solid-js"
import { Dialog } from "@kilocode/kilo-ui/dialog"
import { Button } from "@kilocode/kilo-ui/button"
import { useLanguage } from "../../context/language"
import type { MarketplaceItem } from "../../types/marketplace"

interface RemoveDialogProps {
  item: MarketplaceItem
  scope: "project" | "global"
  onClose: () => void
  onConfirm: () => void
}

export const RemoveDialog: Component<RemoveDialogProps> = (props) => {
  const { t } = useLanguage()

  const label = createMemo(() => {
    if (props.item.type === "mcp") return t("marketplace.remove.type.mcp")
    if (props.item.type === "skill") return t("marketplace.remove.type.skill")
    return t("marketplace.remove.type.mode")
  })

  const scopeLabel = createMemo(() =>
    props.scope === "project" ? t("marketplace.scope.project") : t("marketplace.scope.global"),
  )

  return (
    <Dialog title={t("marketplace.remove.title", { name: props.item.name })} fit>
      <div class="install-modal-body">
        <p>{t("marketplace.remove.confirm", { type: label(), scope: scopeLabel() })}</p>
      </div>
      <div class="install-modal-footer">
        <Button variant="secondary" onClick={props.onClose}>
          {t("marketplace.cancel")}
        </Button>
        <Button variant="primary" class="danger-btn" onClick={props.onConfirm}>
          {t("marketplace.remove")}
        </Button>
      </div>
    </Dialog>
  )
}
