/**
 * MessageList component
 * Scrollable turn-based message list.
 * Each user message is rendered as a VscodeSessionTurn — a custom component that
 * renders all assistant parts as a flat, verbose list with no context grouping,
 * and fully expands sub-agent (task tool) parts inline.
 * Shows recent sessions in the empty state for quick resumption.
 */

import { Component, For, Show, createEffect, createMemo, createSignal, on, onCleanup, JSX } from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"
import { Spinner } from "@kilocode/kilo-ui/spinner"
import { useDialog } from "@kilocode/kilo-ui/context/dialog"
import { createAutoScroll } from "@kilocode/kilo-ui/hooks"
import { useSession } from "../../context/session"
import { useServer } from "../../context/server"
import { useLanguage } from "../../context/language"
import { formatRelativeDate } from "../../utils/date"
import { FeedbackDialog } from "./FeedbackDialog"
import { VscodeSessionTurn } from "./VscodeSessionTurn"
import { RevertBanner } from "./RevertBanner"
import { AccountSwitcher } from "../shared/AccountSwitcher"
import { KiloNotifications } from "./KiloNotifications"
import { WorkingIndicator } from "../shared/WorkingIndicator"
import { activeUserMessageID as getActiveUserMessageID } from "../../context/session-queue"

const KiloLogo = (): JSX.Element => {
  const iconsBaseUri = (window as { ICONS_BASE_URI?: string }).ICONS_BASE_URI || ""
  const isLight =
    document.body.classList.contains("vscode-light") || document.body.classList.contains("vscode-high-contrast-light")
  const iconFile = isLight ? "kilo-light.svg" : "kilo-dark.svg"

  return (
    <div class="kilo-logo">
      <img src={`${iconsBaseUri}/${iconFile}`} alt="Kilo Code" />
    </div>
  )
}

interface MessageListProps {
  onSelectSession?: (id: string) => void
  onShowHistory?: () => void
}

export const MessageList: Component<MessageListProps> = (props) => {
  const session = useSession()
  const server = useServer()
  const language = useLanguage()
  const dialog = useDialog()

  const autoScroll = createAutoScroll({
    working: () => session.status() !== "idle",
  })

  // Resume auto-scroll when a bottom-dock permission/question is dismissed
  const onResumeAutoScroll = () => autoScroll.resume()
  window.addEventListener("resumeAutoScroll", onResumeAutoScroll)
  onCleanup(() => window.removeEventListener("resumeAutoScroll", onResumeAutoScroll))

  // Scroll to bottom on session switch. The deferRender + staging mechanism
  // unmounts and remounts the list, losing scrollTop. Resume auto-scroll
  // after each staging step so the view follows the bottom as turns mount.
  createEffect(
    on(
      () => session.currentSessionID(),
      () => autoScroll.resume(),
    ),
  )

  let loaded = false
  createEffect(() => {
    if (!loaded && server.isConnected() && session.sessions().length === 0) {
      loaded = true
      session.loadSessions()
    }
  })

  const allUserMessages = () => session.userMessages()
  const boundary = () => session.revert()?.messageID
  const userMessages = createMemo(() => {
    const b = boundary()
    if (!b) return allUserMessages()
    return allUserMessages().filter((m) => m.id < b)
  })
  // --- History windowing ---
  // Only render the most recent N user turns. Older turns are revealed when
  // the user scrolls near the top (matching the desktop app pattern).
  const TURN_INIT = 10
  const TURN_BATCH = 8
  const [windowSize, setWindowSize] = createSignal(TURN_INIT)

  // Single effect for session switch: reset window AND start staged mounting.
  // Must be one effect to guarantee ordering (window resets before staging reads it).
  const STAGE_INIT = 1
  const STAGE_BATCH = 3
  const [staged, setStaged] = createSignal(Infinity) // Infinity = no staging limit
  let stageGen = 0
  onCleanup(() => {
    ++stageGen
  }) // Cancel any in-flight staging rAF chain on unmount

  createEffect(
    on(
      () => session.currentSessionID(),
      () => {
        // 1. Reset window size
        setWindowSize(TURN_INIT)

        // 2. Start staged mounting with cancellation token
        const gen = ++stageGen
        // Read windowed length after window reset (Solid batches within the effect)
        const total = Math.min(TURN_INIT, userMessages().length)
        if (total <= STAGE_INIT) {
          setStaged(Infinity)
          return
        }
        setStaged(STAGE_INIT)
        let current = STAGE_INIT
        const step = () => {
          if (gen !== stageGen) return
          current = Math.min(current + STAGE_BATCH, total)
          setStaged(current)
          if (current < total) requestAnimationFrame(step)
          else setStaged(Infinity)
        }
        requestAnimationFrame(step)
      },
    ),
  )

  const windowed = createMemo(() => {
    const all = userMessages()
    const size = windowSize()
    return size >= all.length ? all : all.slice(all.length - size)
  })

  // Whether older turns exist above the window
  const hasMore = () => windowSize() < userMessages().length

  const revealMore = () => {
    if (!hasMore()) return
    const el = scrollEl
    if (!el) {
      setWindowSize((s) => Math.min(s + TURN_BATCH, userMessages().length))
      return
    }
    const before = el.scrollHeight
    setWindowSize((s) => Math.min(s + TURN_BATCH, userMessages().length))
    // Adjust scrollTop before next paint so the viewport doesn't jump
    queueMicrotask(() => {
      el.scrollTop += el.scrollHeight - before
    })
  }

  const rendered = createMemo(() => {
    const all = windowed()
    const cap = staged()
    if (cap >= all.length) return all
    return all.slice(all.length - cap)
  })

  const isEmpty = () => userMessages().length === 0 && !session.loading() && !boundary()

  const recent = createMemo(() =>
    [...session.sessions()]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3),
  )

  let scrollEl: HTMLDivElement | undefined

  const activeUserID = createMemo(() => getActiveUserMessageID(session.messages(), session.statusInfo()))

  return (
    <div class="message-list-container">
      <Show when={isEmpty()}>
        <div class="welcome-header">
          <AccountSwitcher class="account-switcher-welcome" />
          <KiloNotifications />
        </div>
      </Show>
      <div
        ref={(el: HTMLDivElement) => {
          autoScroll.scrollRef(el)
          scrollEl = el
        }}
        onScroll={() => {
          autoScroll.handleScroll()
          if (scrollEl && scrollEl.scrollTop < 200 && hasMore()) revealMore()
        }}
        class="message-list"
        role="log"
        aria-live="polite"
      >
        <div ref={autoScroll.contentRef} class={isEmpty() ? "message-list-content-empty" : undefined}>
          <Show when={session.loading()}>
            <div class="message-list-loading" role="status">
              <Spinner />
              <span>{language.t("session.messages.loading")}</span>
            </div>
          </Show>
          <Show when={isEmpty()}>
            <div class="message-list-empty">
              <KiloLogo />
              <p class="kilo-about-text">{language.t("session.messages.welcome")}</p>
              <Show when={recent().length > 0 && props.onSelectSession}>
                <div class="recent-sessions">
                  <span class="recent-sessions-label">{language.t("session.recent")}</span>
                  <For each={recent()}>
                    {(s) => (
                      <button class="recent-session-item" onClick={() => props.onSelectSession?.(s.id)}>
                        <span class="recent-session-title">{s.title || language.t("session.untitled")}</span>
                        <span class="recent-session-date">{formatRelativeDate(s.updatedAt)}</span>
                      </button>
                    )}
                  </For>
                  <Show when={props.onShowHistory}>
                    <button class="show-history-btn" onClick={() => props.onShowHistory?.()}>
                      <Icon name="history" size="small" />
                      {language.t("session.showHistory")}
                    </button>
                  </Show>
                </div>
              </Show>
              <button class="feedback-button" onClick={() => dialog.show(() => <FeedbackDialog />)}>
                <Icon name="bubble-5" size="small" />
                {language.t("feedback.button")}
              </button>
            </div>
          </Show>
          <Show when={!session.loading() && !session.deferRender()}>
            <Show when={hasMore()}>
              <button class="load-more-turns" onClick={revealMore}>
                <Icon name="arrow-up" size="small" />
                {language.t("session.messages.loadMore") ?? "Load older messages"}
              </button>
            </Show>
            <For each={rendered()}>
              {(msg) => {
                const queued = createMemo(() => {
                  const active = activeUserID()
                  if (!active) return false
                  return msg.id > active
                })

                return (
                  <VscodeSessionTurn
                    sessionID={session.currentSessionID() ?? ""}
                    messageID={msg.id}
                    queued={queued()}
                  />
                )
              }}
            </For>
            <Show when={boundary()}>
              <RevertBanner />
            </Show>
            <WorkingIndicator />
          </Show>
        </div>
      </div>

      <Show when={autoScroll.userScrolled() && staged() >= windowed().length && !session.deferRender()}>
        <button
          class="scroll-to-bottom-button"
          onClick={() => autoScroll.resume()}
          aria-label={language.t("session.messages.scrollToBottom")}
        >
          <Icon name="arrow-down-to-line" />
        </button>
      </Show>
    </div>
  )
}
