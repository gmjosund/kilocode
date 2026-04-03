---
title: "Migrating from Other Tools"
description: "Guide for migrating to Kilo Code from other AI coding tools"
---

# Migrating from Other Tools

Kilo Code is designed to work alongside or replace other AI coding tools. Whether you're coming from a terminal-based agent, an IDE extension, or an inline completion tool, Kilo has a migration path for you.

## Dedicated Migration Guides

We have detailed guides for the most common tools:

- **[Migrating from Cursor / Windsurf](/docs/getting-started/migrating)** — Convert `.cursor/rules/` and `.windsurf/rules/` to Kilo's rule system
- **[Migrating from Claude Code](/docs/getting-started/migrating-from-claude-code)** — Use your `CLAUDE.md` and `.claude/skills/` directly, or migrate to Kilo-native config
- **[Migrating from Cline](/docs/getting-started/switching-from-cline)** — Transition from Cline's single-agent model to Kilo's specialized agents

---

## Other Tools

### GitHub Copilot

GitHub Copilot focuses on inline completions and chat. Kilo provides both inline completions (Ghost) and a full agentic workflow.

**Migrate your instructions:**

If you have a `.github/copilot-instructions.md` file, copy its contents to Kilo's rules:

```bash
mkdir -p .kilocode/rules
cp .github/copilot-instructions.md .kilocode/rules/project-instructions.md
```

**Enable inline completions:**

If you rely on Copilot's inline suggestions, enable Kilo's Ghost feature in Settings > Ghost. This provides the same tab-to-accept experience.

**Replace Copilot Chat with agents:**

- **Ask agent** for questions about code (replaces `@workspace` queries)
- **Code agent** for generating implementations
- **Debug agent** for troubleshooting errors

| GitHub Copilot                    | Kilo Code                        | Notes                                   |
| --------------------------------- | -------------------------------- | --------------------------------------- |
| Inline completions                | Ghost autocomplete               | Enable in Settings > Ghost              |
| Copilot Chat                      | Specialized agents               | Code, Ask, Debug, Plan                  |
| `.github/copilot-instructions.md` | `.kilocode/rules/` + `AGENTS.md` | More flexible rule system               |
| GitHub-only models                | 500+ models                      | Bring your own keys or use Kilo Gateway |

### Aider

Aider is a terminal-based AI coding assistant. Kilo's CLI provides a similar terminal experience with additional capabilities.

**Install and run:**

```bash
npm install -g @kilocode/cli
kilo
```

**Migrate configuration:**

```bash
mkdir -p .kilocode/rules
# Move any .aider instruction files
cp .aider.instructions.md .kilocode/rules/project-instructions.md
```

| Aider                | Kilo Code                                | Notes                            |
| -------------------- | ---------------------------------------- | -------------------------------- |
| Terminal UI          | Terminal TUI + VS Code + JetBrains + Web | Same engine, multiple interfaces |
| `.aider.conf.yml`    | `kilo.json` + `.kilocode/rules/`         | JSON config and Markdown rules   |
| Git-centric workflow | Git-aware with checkpoints and sessions  | Automatic session saving         |
| BYOK only            | BYOK or Kilo Gateway                     | Managed gateway with 500+ models |

---

## Universal Compatibility

### AGENTS.md

If your project has an `AGENTS.md` file, Kilo loads it automatically. This is the emerging cross-tool standard for agent instructions — no migration needed.

```bash
# Verify it exists
ls AGENTS.md
# That's it — Kilo loads it by default
```

See [AGENTS.md documentation](/docs/customize/agents-md) for details on the format and how Kilo uses it.

### Start Incrementally

You don't need to migrate everything at once:

1. **Install Kilo** in your preferred environment
2. **Enable compatibility** for your previous tool (e.g., the [Claude Code compatibility toggle](/docs/getting-started/migrating-from-claude-code))
3. **Start using Kilo** with your existing configuration
4. **Gradually migrate** to Kilo-native formats as you discover features like agent-specific rules and skills

---

## Next Steps

- [Quickstart guide](/docs/getting-started/quickstart) — Get up and running in minutes
- [Custom Rules](/docs/customize/custom-rules) — Configure rules for your project
- [Skills](/docs/customize/skills) — Create and manage reusable skills
- [Custom Modes](/docs/customize/custom-modes) — Define specialized workflows
- [Join our Discord](https://kilo.ai/discord) — Get migration help from the community
