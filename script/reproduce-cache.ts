#!/usr/bin/env bun
/**
 * reproduce-cache.ts
 *
 * Reproduction script for prompt caching not working across providers.
 *
 * Known issues being tested:
 *   1. OpenRouter: cacheWriteInputTokens silently reported as 0 (session/index.ts:877)
 *   2. Bedrock: non-Claude models never get cachePoint (transform.ts:304-314)
 *   3. Dynamic system prompt mixing with static breaks prefix caching
 *   4. providerID-based guard misses models where providerID != "anthropic" but npm == "@ai-sdk/anthropic"
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   OPENROUTER_API_KEY=sk-or-... \
 *   AWS_ACCESS_KEY_ID=... \
 *   AWS_SECRET_ACCESS_KEY=... \
 *   AWS_REGION=us-east-1 \
 *   bun run script/reproduce-cache.ts
 *
 * All three providers are tested independently. Missing env vars skip that provider.
 * Run this from the repo root.
 */

import { readFileSync, existsSync } from "fs"
import { join } from "path"

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY
const AWS_REGION = process.env.AWS_REGION ?? "us-east-1"

// How many sequential requests to fire per provider (first writes cache, rest should hit it)
const ROUNDS = parseInt(process.env.ROUNDS ?? "4")

// Model IDs
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022"
const BEDROCK_MODEL = process.env.BEDROCK_MODEL ?? "anthropic.claude-3-5-sonnet-20241022-v2:0"
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-sonnet"

// ---------------------------------------------------------------------------
// Build a large static context from real files in this repo so the token
// count easily clears the 1024-token minimum required for Anthropic caching.
// ---------------------------------------------------------------------------
function buildLargeContext(): string {
  const candidates = [
    "packages/opencode/src/provider/transform.ts",
    "packages/opencode/src/session/index.ts",
    "packages/opencode/src/session/prompt.ts",
    "packages/opencode/src/provider/models.ts",
    "packages/opencode/src/provider/provider.ts",
    "AGENTS.md",
    "README.md",
  ]
  const parts: string[] = []
  let chars = 0
  for (const rel of candidates) {
    const abs = join(import.meta.dir, "..", rel)
    if (!existsSync(abs)) continue
    const content = readFileSync(abs, "utf8")
    parts.push(`\n\n===== FILE: ${rel} =====\n${content}`)
    chars += content.length
    if (chars > 60_000) break // ~15k+ tokens, well above all model minimums
  }
  return parts.join("")
}

const STATIC_CONTEXT = buildLargeContext()
console.log(
  `Static context size: ${STATIC_CONTEXT.length} chars (~${Math.round(STATIC_CONTEXT.length / 4)} tokens estimated)\n`,
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CacheStats {
  round: number
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheWrite: number
  cacheRead: number
  error?: string
}

function printStats(stats: CacheStats) {
  const cacheStatus = stats.error
    ? `ERROR: ${stats.error}`
    : stats.cacheRead > 0
      ? `✅ CACHE HIT  (read=${stats.cacheRead})`
      : stats.cacheWrite > 0
        ? `📝 CACHE WRITE (write=${stats.cacheWrite})`
        : `❌ NO CACHE   (ensure prompt is large enough)`

  console.log(
    `  [Round ${stats.round}] ${stats.provider}/${stats.model.split("/").pop()} ` +
      `in=${stats.inputTokens} out=${stats.outputTokens} ${cacheStatus}`,
  )
}

const questions = [
  "What is the main purpose of the applyCaching function?",
  "How does the guard condition decide when to apply caching?",
  "What are the known bugs with cache token tracking?",
  "How does the session index track cacheWriteInputTokens?",
]

// ---------------------------------------------------------------------------
// Provider 1: Direct Anthropic API
// ---------------------------------------------------------------------------
async function testAnthropic(): Promise<void> {
  console.log("\n══════════════════════════════════════════")
  console.log("  PROVIDER: Anthropic (direct API)")
  console.log("══════════════════════════════════════════")

  if (!ANTHROPIC_KEY) {
    console.log("  SKIPPED — set ANTHROPIC_API_KEY to enable")
    return
  }

  for (let i = 1; i <= ROUNDS; i++) {
    const question = questions[(i - 1) % questions.length]
    const body = {
      model: ANTHROPIC_MODEL,
      max_tokens: 256,
      system: [
        {
          type: "text",
          text: "You are an expert code reviewer. Answer questions about the following codebase.",
        },
        {
          type: "text",
          text: STATIC_CONTEXT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: question }],
    }

    const stats: CacheStats = {
      round: i,
      provider: "anthropic",
      model: ANTHROPIC_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      cacheWrite: 0,
      cacheRead: 0,
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as any
      if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error))
      stats.inputTokens = data.usage?.input_tokens ?? 0
      stats.outputTokens = data.usage?.output_tokens ?? 0
      stats.cacheWrite = data.usage?.cache_creation_input_tokens ?? 0
      stats.cacheRead = data.usage?.cache_read_input_tokens ?? 0
    } catch (err: any) {
      stats.error = err.message
    }

    printStats(stats)
  }
}

// ---------------------------------------------------------------------------
// Provider 2: AWS Bedrock (Converse API with cachePoint)
// ---------------------------------------------------------------------------
async function testBedrock(): Promise<void> {
  console.log("\n══════════════════════════════════════════")
  console.log("  PROVIDER: AWS Bedrock (Converse API)")
  console.log("══════════════════════════════════════════")

  if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
    console.log("  SKIPPED — set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY to enable")
    return
  }

  // Dynamically import Bedrock SDK (available via opencode deps)
  let BedrockRuntimeClient: any, ConverseCommand: any
  try {
    const mod = await import("@aws-sdk/client-bedrock-runtime")
    BedrockRuntimeClient = mod.BedrockRuntimeClient
    ConverseCommand = mod.ConverseCommand
  } catch {
    console.log("  SKIPPED — @aws-sdk/client-bedrock-runtime not resolvable from script")
    console.log("  Try: bun add @aws-sdk/client-bedrock-runtime in packages/opencode/")
    return
  }

  const client = new BedrockRuntimeClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY,
      secretAccessKey: AWS_SECRET_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
  })

  for (let i = 1; i <= ROUNDS; i++) {
    const question = questions[(i - 1) % questions.length]
    const stats: CacheStats = {
      round: i,
      provider: "bedrock",
      model: BEDROCK_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      cacheWrite: 0,
      cacheRead: 0,
    }

    try {
      const cmd = new ConverseCommand({
        modelId: BEDROCK_MODEL,
        system: [
          { text: "You are an expert code reviewer. Answer questions about the following codebase." },
          { text: STATIC_CONTEXT },
          // cachePoint must come after the content blocks it covers
          { cachePoint: { type: "default" } },
        ],
        messages: [
          {
            role: "user",
            content: [{ text: question }],
          },
        ],
        inferenceConfig: { maxTokens: 256 },
      })
      const res = await client.send(cmd)
      stats.inputTokens = res.usage?.inputTokens ?? 0
      stats.outputTokens = res.usage?.outputTokens ?? 0
      stats.cacheWrite = res.usage?.cacheWriteInputTokens ?? 0
      stats.cacheRead = res.usage?.cacheReadInputTokens ?? 0
    } catch (err: any) {
      stats.error = err.message ?? String(err)
    }

    printStats(stats)
  }
}

// ---------------------------------------------------------------------------
// Provider 3: OpenRouter (OpenAI-compatible endpoint with cache_control)
// ---------------------------------------------------------------------------
async function testOpenRouter(): Promise<void> {
  console.log("\n══════════════════════════════════════════")
  console.log("  PROVIDER: OpenRouter")
  console.log("══════════════════════════════════════════")

  if (!OPENROUTER_KEY) {
    console.log("  SKIPPED — set OPENROUTER_API_KEY to enable")
    return
  }

  for (let i = 1; i <= ROUNDS; i++) {
    const question = questions[(i - 1) % questions.length]
    const body = {
      model: OPENROUTER_MODEL,
      // Use provider sticky routing so the same backend is reused across requests
      provider: { allow_fallbacks: false },
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: "You are an expert code reviewer. Answer questions about the following codebase.",
            },
            {
              type: "text",
              text: STATIC_CONTEXT,
              cache_control: { type: "ephemeral" },
            },
          ],
        },
        { role: "user", content: question },
      ],
      max_tokens: 256,
    }

    const stats: CacheStats = {
      round: i,
      provider: "openrouter",
      model: OPENROUTER_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      cacheWrite: 0,
      cacheRead: 0,
    }

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": "https://github.com/Kilo-Org/kilocode",
          "X-Title": "Kilocode Cache Repro",
        },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as any
      if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error))
      stats.inputTokens = data.usage?.prompt_tokens ?? 0
      stats.outputTokens = data.usage?.completion_tokens ?? 0
      // OpenRouter reports cache stats in prompt_tokens_details
      stats.cacheRead = data.usage?.prompt_tokens_details?.cached_tokens ?? 0
      stats.cacheWrite = data.usage?.prompt_tokens_details?.cache_write_tokens ?? 0
      // NOTE: kilocode currently only checks metadata.openrouter for cacheWriteInputTokens —
      // but the field is never populated, so cache writes are silently reported as 0.
      // This is Bug #1 from session/index.ts:877.
      if (stats.cacheWrite === 0 && stats.cacheRead === 0 && i === 1) {
        console.log(
          "  [Note] Raw usage from OpenRouter:",
          JSON.stringify(data.usage?.prompt_tokens_details ?? data.usage ?? {}),
        )
      }
    } catch (err: any) {
      stats.error = err.message ?? String(err)
    }

    printStats(stats)
  }
}

// ---------------------------------------------------------------------------
// Bug reproduction: demonstrate that opencode's internal applyCaching guard
// misses providers where model.providerID !== "anthropic" but api.npm === "@ai-sdk/anthropic"
// ---------------------------------------------------------------------------
function demonstrateGuardBug(): void {
  console.log("\n══════════════════════════════════════════")
  console.log("  BUG DEMO: applyCaching guard condition")
  console.log("  (packages/opencode/src/provider/transform.ts:304-314)")
  console.log("══════════════════════════════════════════")

  // Simulate model objects as they would appear inside opencode
  const models = [
    {
      label: "Anthropic direct (works correctly)",
      providerID: "anthropic",
      api: { id: "anthropic", npm: "@ai-sdk/anthropic" },
      id: "claude-3-5-sonnet-20241022",
    },
    {
      label: "Bedrock Claude via @ai-sdk/amazon-bedrock (should work)",
      providerID: "amazon-bedrock",
      api: { id: "anthropic.claude-3-5-sonnet-20241022-v2:0", npm: "@ai-sdk/amazon-bedrock" },
      id: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    },
    {
      label:
        "Kimi K2.5 via @ai-sdk/anthropic (currently works via api.npm fallback, but WRONG cache level used: providerID='kimi' fails useMessageLevelOptions check at line 200)",
      providerID: "kimi",
      api: { id: "kimi-k2", npm: "@ai-sdk/anthropic" },
      id: "kimi-k2",
    },
    {
      label: "Custom provider with 'claude' in model.id (works via string match)",
      providerID: "custom",
      api: { id: "custom-provider", npm: "@ai-sdk/openai-compatible" },
      id: "claude-custom",
    },
    {
      label: "Gateway model (correctly excluded from applyCaching)",
      providerID: "anthropic",
      api: { id: "anthropic", npm: "@ai-sdk/gateway" },
      id: "claude-3-5-sonnet-20241022",
    },
  ]

  for (const m of models) {
    // Replicate exact guard from transform.ts:304-314
    const willApplyCaching =
      (m.providerID === "anthropic" ||
        m.api.id.includes("anthropic") ||
        m.api.id.includes("claude") ||
        m.id.includes("anthropic") ||
        m.id.includes("claude") ||
        m.api.npm === "@ai-sdk/anthropic") &&
      m.api.npm !== "@ai-sdk/gateway"

    const status = willApplyCaching ? "✅ applyCaching CALLED" : "❌ applyCaching SKIPPED"
    console.log(`  ${status}`)
    console.log(`    ${m.label}`)
  }

  // Secondary bug: even when applyCaching IS called, the message-level vs content-level
  // placement check uses providerID, not api.npm (transform.ts:200)
  console.log("\n  Secondary bug — cache placement level (transform.ts:200):")
  const kimi = { providerID: "kimi", api: { id: "kimi-k2", npm: "@ai-sdk/anthropic" } }
  const useMessageLevel = kimi.providerID === "anthropic" || kimi.providerID.includes("bedrock")
  console.log(
    `  Kimi via @ai-sdk/anthropic: useMessageLevelOptions=${useMessageLevel} ` +
      `(should be TRUE for Anthropic SDK — cache_control is placed on CONTENT PART instead of MESSAGE, may not work)`,
  )
  console.log(`
  Fix: replace providerID === "anthropic" check with model.api.npm === "@ai-sdk/anthropic"
  See upstream issue: https://github.com/anomalyco/opencode/issues/14642
  `)
}

// ---------------------------------------------------------------------------
// Bug reproduction: cacheWriteInputTokens lookup misses OpenRouter namespace
// ---------------------------------------------------------------------------
function demonstrateTokenTrackingBug(): void {
  console.log("\n══════════════════════════════════════════")
  console.log("  BUG DEMO: cacheWriteInputTokens tracking")
  console.log("  (packages/opencode/src/session/index.ts:876-883)")
  console.log("══════════════════════════════════════════")

  // Simulate what opencode receives from providers vs what it reads
  const scenarios = [
    {
      label: "Anthropic direct",
      metadata: { anthropic: { cacheCreationInputTokens: 12500 } },
      expected: 12500,
    },
    {
      label: "AWS Bedrock",
      metadata: { bedrock: { usage: { cacheWriteInputTokens: 9000 } } },
      expected: 9000,
    },
    {
      label: "OpenRouter via Claude (BUG: openrouter namespace not checked!)",
      // OpenRouter puts stats in usage.prompt_tokens_details, not in metadata.openrouter
      metadata: { openrouter: {} },
      expected: 0, // kilocode reads 0 even though OpenRouter reported a cache write
      actual_available_in_usage: { prompt_tokens_details: { cache_write_tokens: 8000 } },
    },
  ]

  for (const s of scenarios) {
    // Replicate exact lookup from session/index.ts:876-882
    const read =
      (s.metadata as any)?.["anthropic"]?.["cacheCreationInputTokens"] ??
      (s.metadata as any)?.["bedrock"]?.["usage"]?.["cacheWriteInputTokens"] ??
      (s.metadata as any)?.["venice"]?.["usage"]?.["cacheCreationInputTokens"] ??
      0

    const ok = read === s.expected
    console.log(`  ${ok ? "✅" : "❌"} ${s.label}: read=${read} expected=${s.expected}`)
    if (!ok && (s as any).actual_available_in_usage) {
      console.log(`     Actual response field: ${JSON.stringify((s as any).actual_available_in_usage)}`)
      console.log(`     The metadata.openrouter namespace is never populated with cache token counts.`)
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log("===========================================")
console.log("  Kilocode Prompt Cache Reproduction Script")
console.log("===========================================")
console.log(`Rounds per provider: ${ROUNDS}`)
console.log(`Models: anthropic=${ANTHROPIC_MODEL} bedrock=${BEDROCK_MODEL} openrouter=${OPENROUTER_MODEL}`)

// Run static bug demonstrations (no API calls needed)
demonstrateGuardBug()
demonstrateTokenTrackingBug()

// Run live API tests in parallel across providers
await Promise.all([testAnthropic(), testBedrock(), testOpenRouter()])

console.log("\n===========================================")
console.log("  Done. Check output above for cache stats.")
console.log("===========================================")
console.log(`
Expected results when caching works:
  Round 1:  cacheWrite > 0, cacheRead == 0  (cache populated)
  Round 2+: cacheWrite == 0, cacheRead > 0  (cache hit)

If you see cacheWrite==0 AND cacheRead==0 on all rounds:
  - The prompt may be too short for the model's minimum token requirement
  - The cache_control marker may not be reaching the provider correctly
  - For Bedrock: verify the model ID contains 'anthropic' or 'claude' (transform.ts:304)
  - For OpenRouter: cacheWrite is always shown as 0 in kilocode UI due to
    session/index.ts:877 not checking the openrouter metadata namespace
`)
