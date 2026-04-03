---
title: "Migrating from Cline"
description: "A practical guide for developers switching from Cline to Kilo Code"
---

# Migrating from Cline to Kilo

A practical guide for developers switching from Cline to Kilo.

## Why Switch?

**Speed.** The Kilo Platform is designed to reduce friction across the entire development workflow. Beyond feature parity with Cline, Kilo includes Code Reviews, App Builder, Cloud Agents, and one-click Deploy.

**Multi-platform.** Work in VS Code, JetBrains IDEs, CLI, or the web. Your Sessions sync across all of them automatically.

**Specialized agents.** Instead of one agent doing everything, Kilo has specialized agents optimized for different parts of your workflow.

**500+ models.** More providers, more options, better pricing flexibility. Switch models mid-conversation if you want.

---

## Understanding Kilo's Agent System

Cline uses a single agent with a Plan/Act toggle. Kilo takes a different approach with specialized agents, each optimized for a specific part of development. You select agents from a dropdown in the VS Code extension, or with slash commands in the CLI.

### Kilo's Built-in Agents

#### Code Agent (default)

- **What it does:** Implementation and refactoring
- **Cline equivalent:** Act mode
- **When to use:** Writing features, fixing bugs, making changes
- **Example:** "Add user authentication to the API"

#### Ask Agent

- **What it does:** Answers questions, explains code
- **Cline equivalent:** Plan mode (read-only exploration)
- **When to use:** Understanding codebases, learning patterns
- **Example:** "How does our caching layer work?"

#### Debug Agent

- **What it does:** Systematic troubleshooting and error diagnosis
- **Cline equivalent:** Act mode focused on debugging
- **When to use:** Tracking down bugs, fixing runtime issues
- **Example:** "Why is this API endpoint returning 500?"

#### Plan Agent

- **What it does:** Planning, design, and architecture
- **Cline equivalent:** Plan mode (exploration and planning)
- **When to use:** Before complex refactors, designing new systems
- **Example:** "Design a caching strategy for our API"

{% callout type="info" %}
Agents with full tool access (Code, Plan, Debug) can delegate work to **subagents** using the `task` tool. This means any of these agents can break down complex tasks and coordinate subtasks automatically — there's no need for a dedicated orchestration step.
{% /callout %}

### Agent Switching in Action

**Cline workflow:** Toggle Plan/Act -> Submit task -> Plan phase -> Approve -> Act phase -> Checkpoint

**Kilo workflow:**
Select agent from dropdown -> Build -> Switch agents as needed -> Checkpoint -> Session auto-saves

#### Example: Refactoring authentication

**Cline:**

1. Enable Plan/Act mode
2. "Refactor auth to use OAuth2"
3. Wait for plan -> Review -> Approve
4. Watch step-by-step execution
5. Checkpoint when done

**Kilo:**

1. Select **Code** from the agent dropdown
2. "Implement OAuth2 refactor for our authentication"
3. Code agent delegates subtasks automatically (plans the architecture, implements the OAuth2 client)
4. Session/checkpoints preserved automatically

#### Example: Understanding unfamiliar code

**Cline:** Use Plan mode (but risk accidentally switching to Act)

**Kilo:** Select **Ask** from the dropdown

- "Explain how the payment processing flow works"
- "What external services does this integrate with?"
- Ask agent never writes files, so exploration is always safe

**Why this matters:** In Cline, you might accidentally make changes while exploring. In Kilo, Ask and Plan agents can't write files, so you're safe to explore without worry.

---

## Installation

### VS Code / Cursor

1. Open Extensions (`Cmd/Ctrl + Shift + X`)
2. Search "Kilo Code"
3. Click Install
4. Find the Kilo icon in your sidebar

### JetBrains IDEs

Supports IntelliJ, PyCharm, WebStorm, and all JetBrains IDEs.

**Prerequisites:**

- JetBrains Toolbox (required for auth)
- Node.js LTS

**Install:**

1. Settings -> Plugins -> Marketplace
2. Search "Kilo Code"
3. Install and restart
4. Find Kilo icon in right sidebar

### CLI

```shell
npm install -g @kilocode/cli
kilo
```

### Web (Cloud Agents & App Builder)

Visit [app.kilo.ai](https://app.kilo.ai/) and sign in. This gives you access to:

- **Cloud Agents:** Run Kilo without a local machine
- **App Builder:** Build and preview apps directly in your browser
- **Kilo Deploy:** One-click deployments
- **Code Reviews:** AI-powered PR analysis

---

## Initial Setup

### Create account

1. Click "Try Kilo Code for Free" in the Kilo panel
2. Sign in with OAuth at kilo.ai
3. You'll be redirected back to your IDE

### Configure your provider

**Option 1: Use Kilo Gateway (easiest)**

1. Open settings (gear icon)
2. Select "Kilo Gateway" as provider
3. Choose a model (such as Claude Opus 4.5, Gemini 3, MiniMax M2.1)

**Option 2: Bring your own API keys**

1. Select your provider (Anthropic, OpenAI, etc.)
2. Enter your API key
3. Choose your model

---

## Migrating Your Configuration

### Custom Rules

Cline's `.clinerules` files map directly to Kilo's rule system:

```bash
# Create Kilo rules directory
mkdir -p .kilocode/rules

# Copy existing Cline rules
cp .clinerules .kilocode/rules/project-rules.md
```

Mode-specific Cline rules (`.clinerules-code`, `.clinerules-ask`, etc.) map to Kilo's mode-specific directories:

```bash
mkdir -p .kilocode/rules-code
mkdir -p .kilocode/rules-ask
# Move mode-specific rules to corresponding directories
```

### MCP Servers

If you configured MCP servers in Cline, the same servers work in Kilo. MCP configuration lives in your project's `kilo.json` or the global config. See [MCP in Kilo Code](/docs/automate/mcp/using-in-kilo-code) for details.

### AGENTS.md

If your project has an `AGENTS.md` file, Kilo loads it automatically. This is the same standard used across multiple AI coding tools — no migration needed.

---

## Beyond the IDE: Kilo's Platform Features

One of the biggest differences from Cline is that Kilo isn't just an IDE extension. It's a platform with multiple interfaces that can all share your Sessions and context.

### Cloud Agents

Run Kilo from [app.kilo.ai/cloud](https://app.kilo.ai/cloud) without needing your local machine. Great for:

- Working from a tablet or phone
- Offloading heavy tasks
- Parallel execution without blocking your IDE

### Parallel Agents

Run multiple agents simultaneously without conflicts, in both the IDE and CLI. Start an agent working on tests while another handles documentation.

### Sessions

Your conversation history, context, and state sync across all interfaces automatically. Start a task in the CLI, continue in VS Code, check progress on mobile.

### App Builder

Build live apps and sites directly from the web with a real-time preview. Similar to Lovable, but integrated with your Kilo Sessions. Deploy with one click when you're ready.

### Kilo Deploy

One-click deployments from directly within Kilo. Go from code to production without leaving your workflow.

### Code Reviews

Automatically analyzes your PRs using your choice of AI model. Reviews happen the moment a PR is opened or updated, covering performance, security, style, and test coverage.

### Managed Indexing

Semantic search across your repositories using cloud-hosted embeddings. Kilo indexes your codebase to deliver more relevant, context-aware responses.

### Autocomplete

In-line ghost-text completions with tab to complete. Works alongside the agents for a complete coding experience.

---

## Complete Development Workflows

### New Feature Development

**Kilo approach:**

1. **Plan agent:** "Design a user notification system"
2. Review architecture, discuss trade-offs
3. **Code agent:** "Implement the notification service"
4. Fast Apply builds it quickly
5. **Debug agent:** "Email sends aren't working"
6. Fix issues
7. Session auto-saves as "Notifications-Complete"

### Debugging Production Issues

**Kilo approach:**

1. **Debug agent:** "Checkout fails with 'payment_intent_not_found'"
2. Debug agent systematically checks logs, traces API calls
3. **Code agent:** "Add idempotency key to prevent duplicates"
4. Verify fix

### Large Refactoring

**Kilo approach:**

1. **Ask agent:** "Explain our current auth implementation"
2. **Plan agent:** "Design migration to JWT tokens"
3. Session saves as "Auth-Refactor-Plan"
4. **Code agent:** Implement JWT generation, update middleware
5. **Debug agent:** Fix failing tests

### Learning Unfamiliar Code

**Kilo approach:**

1. **Ask agent:** "Explain how payment processing works"
2. "What happens when a payment fails?"
3. "Show me the retry logic"
4. Ask agent never writes, so exploration is completely safe
5. When ready, switch to **Code agent** to make changes

---

## Feature Mapping

| Cline Feature      | Kilo Equivalent        | Notes                                                    |
| ------------------ | ---------------------- | -------------------------------------------------------- |
| Plan mode          | Plan, Ask agents       | Plan designs systems, Ask explains code                  |
| Act mode           | Code agent             | Implementation                                           |
| Plan/Act toggle    | Agent dropdown         | More granular control                                    |
| Checkpoints        | Sessions + Checkpoints | Sessions preserve agent + context                        |
| Background editing | Fast Apply             | Sequential but instant                                   |
| Single agent       | Specialized agents     | Purpose-built for each task                              |
| Local only         | Multi-platform         | IDE, CLI, web, mobile                                    |
| `.clinerules`      | `.kilocode/rules/`     | More flexible rule system with mode-specific directories |

---

## What You Gain

- **Specialized agents:** Purpose-built for different parts of development
- **Subagent delegation:** Any full-access agent can break down complex tasks automatically
- **Fast Apply:** 5-10x faster code application
- **Autocomplete:** Inline AI suggestions
- **Multi-platform:** VS Code, JetBrains, CLI, web
- **Session Persistence:** Sessions preserve agent + context across devices
- **500+ models:** More provider options, switch anytime
- **Cloud Agents:** Work without your local machine
- **App Builder:** Build and preview apps in the browser
- **One-click Deploy:** Ship directly from Kilo
- **Code Reviews:** AI-powered PR analysis
- **Parallel Agents:** Run multiple agents simultaneously

---

## Common Questions

**Q: Do I have to switch agents constantly?** No. Code agent handles most day-to-day work and can delegate subtasks automatically. Switch when you need specialized behavior like read-only exploration (Ask) or architecture planning (Plan).

**Q: What if I forget to switch agents?** Code agent is the default and handles most tasks. It'll still work, just might not be optimized for exploration or planning.

**Q: Can I customize what each agent does?** Yes. Add agent-specific instructions in settings, or create [custom modes](/docs/customize/custom-modes).

**Q: Can I use both Cline and Kilo side-by-side?** Yes. They're separate extensions.

**Q: What's the difference between Cloud Agents and the IDE extension?** Same capabilities, different interface. Cloud Agents run in the browser, so you can work from any device without your local machine.

---

## Next Steps

1. Install Kilo in your primary IDE
2. Try each agent with a small task:
   - **Code:** "Add a hello world endpoint"
   - **Ask:** "Explain what this file does"
   - **Debug:** "Why is this function returning undefined?"
   - **Plan:** "Design a logging system"
3. Try Cloud Agents at [app.kilo.ai](https://app.kilo.ai/)
4. Install the Kilo CLI with `npm install -g @kilocode/cli`
5. Enable Autocomplete for inline suggestions
