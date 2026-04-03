---
title: "Migrating from Claude Code"
description: "Guide for migrating from Claude Code to Kilo Code, including the Claude Code compatibility toggle"
---

# Migrating from Claude Code

Kilo has built-in compatibility with Claude Code configuration files. You can start using Kilo immediately with your existing `CLAUDE.md` instructions and `.claude/skills/`, or migrate them to Kilo-native formats to take advantage of additional features.

---

## Quick Start: Use Your Existing Config

Kilo can load your Claude Code files directly — no migration required. The behavior depends on which Kilo client you're using.

### In the CLI

Claude Code files are loaded **by default** in the CLI. Just install and run:

```bash
npm install -g @kilocode/cli
kilo
```

Kilo automatically picks up:

- `CLAUDE.md` from your project root (and parent directories)
- `~/.claude/CLAUDE.md` from your home directory
- `.claude/skills/` from your project and `~/.claude/skills/` globally

### In VS Code

The VS Code extension **disables** Claude Code file loading by default to keep sessions clean. To enable it:

1. Open the Kilo settings panel (gear icon)
2. Navigate to **Agent Behaviour > Rules**
3. Find the **Claude Code Compatibility** section
4. Toggle **Load Claude Code Files** on
5. Restart the extension

{% callout type="info" %}
The toggle requires an extension restart. After enabling it, reload the window (`Cmd+Shift+P` / `Ctrl+Shift+P` > "Developer: Reload Window").
{% /callout %}

---

## What Gets Loaded

### CLAUDE.md Instructions

When Claude Code compatibility is enabled, Kilo loads `CLAUDE.md` files into the system prompt — the same way Claude Code does. The files are discovered in this order:

| Location                    | Scope   | Notes                                                                |
| --------------------------- | ------- | -------------------------------------------------------------------- |
| `CLAUDE.md` in project root | Project | Loaded via directory walk-up from working directory to worktree root |
| `~/.claude/CLAUDE.md`       | Global  | Your home directory Claude config                                    |

{% callout type="warning" %}
Kilo uses a **first-match-wins** strategy per directory. If a directory contains both `AGENTS.md` and `CLAUDE.md`, only `AGENTS.md` is loaded from that directory. This means if you have both files at your project root, `CLAUDE.md` will be ignored in favor of `AGENTS.md`.
{% /callout %}

### Claude Code Skills

Skills from `.claude/skills/` directories are loaded alongside Kilo's native skills:

| Location                       | Scope         |
| ------------------------------ | ------------- |
| `.claude/skills/**/SKILL.md`   | Project-level |
| `~/.claude/skills/**/SKILL.md` | Global        |

Project-level skills take precedence over global skills when names conflict. Kilo-native skills (`.kilo/skills/`) take precedence over Claude Code compatibility skills.

---

## Environment Variables

For advanced control, Kilo provides granular environment variables:

| Variable                          | Effect                                                          | Default                         |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------- |
| `KILO_DISABLE_CLAUDE_CODE`        | Master switch — disables both `CLAUDE.md` and `.claude/skills/` | `false` (CLI), `true` (VS Code) |
| `KILO_DISABLE_CLAUDE_CODE_PROMPT` | Disables `CLAUDE.md` loading only                               | Inherits from master            |
| `KILO_DISABLE_CLAUDE_CODE_SKILLS` | Disables `.claude/skills/` loading only                         | Inherits from master            |

The VS Code extension manages `KILO_DISABLE_CLAUDE_CODE` automatically based on the compatibility toggle. In the CLI, set these in your shell environment:

```bash
# Disable all Claude Code compatibility
KILO_DISABLE_CLAUDE_CODE=true kilo

# Load CLAUDE.md but skip skills
KILO_DISABLE_CLAUDE_CODE_SKILLS=true kilo

# Load skills but skip CLAUDE.md
KILO_DISABLE_CLAUDE_CODE_PROMPT=true kilo
```

---

## Full Migration to Kilo-Native Config

If you want to move away from Claude Code's configuration format entirely, here's how to convert each piece.

### Convert CLAUDE.md to AGENTS.md

Kilo natively supports `AGENTS.md`, the emerging cross-tool standard for agent instructions. Both files use plain Markdown, so conversion is a straight copy:

```bash
cp CLAUDE.md AGENTS.md
```

For global instructions:

```bash
mkdir -p ~/.config/kilo
cp ~/.claude/CLAUDE.md ~/.config/kilo/AGENTS.md
```

After migrating, you can disable Claude Code compatibility since `AGENTS.md` is always loaded.

{% callout type="tip" %}
`AGENTS.md` is supported by multiple AI coding tools (not just Kilo), making it a more portable choice than `CLAUDE.md`. See [AGENTS.md documentation](/docs/customize/agents-md) for details.
{% /callout %}

### Convert Skills

Move Claude Code skills to Kilo's native skill directory:

```bash
mkdir -p .kilo/skills
cp -r .claude/skills/* .kilo/skills/
```

The skill format is the same — each skill is a directory containing a `SKILL.md` file. Kilo-native skills (`.kilo/skills/`) take precedence over compatibility directories, so after migration you get the same behavior. See [Skills documentation](/docs/customize/skills) for the full format and additional features.

### Convert to Kilo Rules

For more fine-grained control, you can split your `CLAUDE.md` into separate rule files:

```bash
mkdir -p .kilocode/rules
```

Create focused rule files in `.kilocode/rules/`:

- `coding-standards.md` — Language and style preferences
- `testing-guidelines.md` — Test writing conventions
- `api-conventions.md` — API design rules

Kilo's rule system adds **agent-specific rules** that Claude Code doesn't support:

```bash
.kilocode/rules/              # Apply to ALL agents
.kilocode/rules-code/         # Only in Code agent
.kilocode/rules-debug/        # Only in Debug agent
.kilocode/rules-ask/          # Only in Ask agent
```

See [Custom Rules](/docs/customize/custom-rules) for the full rule system.

---

## Feature Comparison

| Claude Code                      | Kilo Code                                   | Notes                                                                                                         |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Single agent                     | Specialized agents (Code, Ask, Debug, Plan) | Each optimized for a specific workflow                                                                        |
| `CLAUDE.md`                      | `AGENTS.md` + `.kilocode/rules/`            | Kilo also reads `CLAUDE.md` with compat enabled                                                               |
| `.claude/skills/`                | `.kilo/skills/`                             | Same format, Kilo also reads `.claude/skills/`                                                                |
| Claude models only               | 500+ models from any provider               | Anthropic, OpenAI, Google, local models, and more                                                             |
| Terminal-based                   | VS Code, JetBrains, CLI, Web                | Sessions sync across all interfaces                                                                           |
| `/` slash commands               | Agent dropdown + slash commands             | Structured agent workflows                                                                                    |
| `--dangerously-skip-permissions` | Per-action auto-approve settings            | [Granular control](/docs/getting-started/settings/auto-approving-actions) over what runs without confirmation |
| Single conversation              | Parallel agents                             | Run multiple agents simultaneously                                                                            |
| No inline completions            | Ghost autocomplete                          | Tab-to-accept inline suggestions                                                                              |
| Local only                       | Cloud Agents + App Builder                  | Work from any device, build and deploy from the web                                                           |

---

## Concept Mapping

If you're used to Claude Code's workflow, here's how to think about things in Kilo:

### Slash Commands

| Claude Code | Kilo                                                           | Notes                                                   |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| `/compact`  | Automatic context condensing                                   | Kilo handles this automatically when context gets large |
| `/clear`    | New session                                                    | Start a fresh session from the sidebar                  |
| `/cost`     | Session cost display                                           | Visible in the session panel                            |
| `/doctor`   | [Troubleshooting guide](/docs/getting-started/troubleshooting) | Built-in diagnostics                                    |
| `/init`     | `AGENTS.md` or `.kilocode/rules/`                              | Create your project instructions                        |
| `/memory`   | `.kilocode/rules/`                                             | Persistent rules instead of ephemeral memory            |
| `/review`   | [Code Reviews](/docs/automate/code-reviews/overview)           | AI-powered PR analysis, runs automatically              |

### Permission Model

Claude Code uses `--dangerously-skip-permissions` as an all-or-nothing flag. Kilo provides granular auto-approve settings:

- **Read operations** — Always allowed
- **File edits** — Can be auto-approved individually
- **Terminal commands** — Can be auto-approved with pattern matching
- **MCP tools** — Can be auto-approved per server

Configure in Settings > [Auto-Approving Actions](/docs/getting-started/settings/auto-approving-actions).

### Project Configuration

| Claude Code               | Kilo                                    | Purpose                       |
| ------------------------- | --------------------------------------- | ----------------------------- |
| `CLAUDE.md`               | `AGENTS.md`                             | Project instructions          |
| `~/.claude/CLAUDE.md`     | `~/.config/kilo/AGENTS.md`              | Global instructions           |
| `.claude/settings.json`   | `kilo.json`                             | Project configuration         |
| `~/.claude/settings.json` | Global settings UI or `~/.config/kilo/` | Global configuration          |
| `.claude/skills/`         | `.kilo/skills/`                         | Reusable skill definitions    |
| `.claudeignore`           | `.kilocodeignore`                       | Files to exclude from context |

---

## Next Steps

- [Quickstart guide](/docs/getting-started/quickstart) — Get up and running in minutes
- [AGENTS.md](/docs/customize/agents-md) — The cross-tool instruction standard
- [Custom Rules](/docs/customize/custom-rules) — Fine-grained rule system
- [Skills](/docs/customize/skills) — Create and manage reusable skills
- [Custom Instructions](/docs/customize/custom-instructions) — All instruction file formats Kilo supports
- [Join our Discord](https://kilo.ai/discord) — Get migration help from the community
