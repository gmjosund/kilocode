type Translator = (key: string, params?: Record<string, string | number>) => string

const DEFAULT_CONTEXT = 128000
const DEFAULT_OUTPUT = 4096
const DEFAULT_PRICE = 0

// Legacy OpenAI-compatible defaults used a 128k context window and 0 pricing.
// The current CLI's openai-compatible fallback models use 128k context and 4096
// output tokens in provider model cache, so the editor mirrors that runtime shape.
export const DEFAULT_MODEL = {
  context: DEFAULT_CONTEXT.toString(),
  output: DEFAULT_OUTPUT.toString(),
  inputPrice: DEFAULT_PRICE.toString(),
  outputPrice: DEFAULT_PRICE.toString(),
}

const OPENAI_COMPATIBLE = "@ai-sdk/openai-compatible"
const PROVIDER_ID = /^[a-z0-9][a-z0-9-_]*$/
const ERR_INT = "provider.custom.error.positiveInteger"
const ERR_NUM = "provider.custom.error.nonNegativeNumber"

export type ModelConfig = {
  name?: string
  cost?: {
    input?: number
    output?: number
    cache_read?: number
    cache_write?: number
  }
  limit?: {
    context?: number
    input?: number
    output?: number
  }
}

export type ModelRow = {
  id: string
  name: string
  context: string
  input: string
  output: string
  inputPrice: string
  outputPrice: string
  cacheRead: string
  cacheWrite: string
  open: boolean
}

export type HeaderRow = {
  key: string
  value: string
}

type ModelRowOpts = {
  open?: boolean
}

export type FormState = {
  providerID: string
  name: string
  baseURL: string
  apiKey: string
  models: ModelRow[]
  headers: HeaderRow[]
  saving: boolean
}

export type FormErrors = {
  providerID: string | undefined
  name: string | undefined
  baseURL: string | undefined
  models: Array<{
    id?: string
    name?: string
    context?: string
    input?: string
    output?: string
    inputPrice?: string
    outputPrice?: string
    cacheRead?: string
    cacheWrite?: string
  }>
  headers: Array<{ key?: string; value?: string }>
}

type ValidateArgs = {
  form: FormState
  t: Translator
  editing: boolean
  disabledProviders: string[]
  existingProviderIDs: Set<string>
  existingEnv?: string[]
}

function pick<T extends Record<string, unknown>>(value: T): Partial<T> | undefined {
  const out = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>
  if (Object.keys(out).length === 0) return undefined
  return out
}

function intValue(value: string, t: Translator, fallback?: number) {
  const text = value.trim()
  if (!text) return { value: fallback }
  const parsed = Number(text)
  if (!Number.isInteger(parsed) || parsed <= 0) return { error: t(ERR_INT) }
  return { value: parsed }
}

function numValue(value: string, t: Translator, fallback?: number) {
  const text = value.trim()
  if (!text) return { value: fallback }
  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed < 0) return { error: t(ERR_NUM) }
  return { value: parsed }
}

function hasErrors(value: FormErrors["models"][number]) {
  return Object.values(value).some(Boolean)
}

function hasOverrides(cfg?: ModelConfig) {
  if (!cfg) return false
  if (cfg.limit?.context !== undefined && cfg.limit.context !== DEFAULT_CONTEXT) return true
  if (cfg.limit?.input !== undefined) return true
  if (cfg.limit?.output !== undefined && cfg.limit.output !== DEFAULT_OUTPUT) return true
  if (cfg.cost?.input !== undefined && cfg.cost.input !== DEFAULT_PRICE) return true
  if (cfg.cost?.output !== undefined && cfg.cost.output !== DEFAULT_PRICE) return true
  if (cfg.cost?.cache_read !== undefined && cfg.cost.cache_read !== DEFAULT_PRICE) return true
  if (cfg.cost?.cache_write !== undefined && cfg.cost.cache_write !== DEFAULT_PRICE) return true
  return false
}

export function modelRow(id = "", name = "", cfg?: ModelConfig, opts?: ModelRowOpts): ModelRow {
  return {
    id,
    name: cfg?.name ?? name,
    context: cfg?.limit?.context?.toString() ?? DEFAULT_MODEL.context,
    input: cfg?.limit?.input?.toString() ?? "",
    output: cfg?.limit?.output?.toString() ?? DEFAULT_MODEL.output,
    inputPrice: cfg?.cost?.input?.toString() ?? DEFAULT_MODEL.inputPrice,
    outputPrice: cfg?.cost?.output?.toString() ?? DEFAULT_MODEL.outputPrice,
    cacheRead: cfg?.cost?.cache_read?.toString() ?? "",
    cacheWrite: cfg?.cost?.cache_write?.toString() ?? "",
    open: opts?.open ?? hasOverrides(cfg),
  }
}

export function modelErrors(): FormErrors["models"][number] {
  return {}
}

export function validateCustomProvider(input: ValidateArgs) {
  const providerID = input.form.providerID.trim()
  const name = input.form.name.trim()
  const baseURL = input.form.baseURL.trim()
  const apiKey = input.form.apiKey.trim()

  const env = apiKey.match(/^\{env:([^}]+)\}$/)?.[1]?.trim()
  const existingEnv = input.editing && !apiKey ? input.existingEnv : undefined
  const key = apiKey && !env ? apiKey : undefined

  const idError = !providerID
    ? input.t("provider.custom.error.providerID.required")
    : !PROVIDER_ID.test(providerID)
      ? input.t("provider.custom.error.providerID.format")
      : undefined

  const nameError = !name ? input.t("provider.custom.error.name.required") : undefined
  const urlError = !baseURL
    ? input.t("provider.custom.error.baseURL.required")
    : !/^https?:\/\//.test(baseURL)
      ? input.t("provider.custom.error.baseURL.format")
      : undefined

  const disabled = input.disabledProviders.includes(providerID)
  const existsError = idError
    ? undefined
    : input.editing
      ? undefined
      : input.existingProviderIDs.has(providerID) && !disabled
        ? input.t("provider.custom.error.providerID.exists")
        : undefined

  const seenModels = new Set<string>()
  const parsedModels = input.form.models.map((m) => {
    const id = m.id.trim()
    const modelName = m.name.trim()
    const modelIdError = !id
      ? input.t("provider.custom.error.required")
      : seenModels.has(id)
        ? input.t("provider.custom.error.duplicate")
        : (() => {
            seenModels.add(id)
            return undefined
          })()
    const context = intValue(m.context, input.t, DEFAULT_CONTEXT)
    const limitInput = intValue(m.input, input.t)
    const output = intValue(m.output, input.t, DEFAULT_OUTPUT)
    const inputPrice = numValue(m.inputPrice, input.t, DEFAULT_PRICE)
    const outputPrice = numValue(m.outputPrice, input.t, DEFAULT_PRICE)
    const cacheRead = numValue(m.cacheRead, input.t)
    const cacheWrite = numValue(m.cacheWrite, input.t)
    const errors = {
      id: modelIdError,
      name: !modelName ? input.t("provider.custom.error.required") : undefined,
      context: context.error,
      input: limitInput.error,
      output: output.error,
      inputPrice: inputPrice.error,
      outputPrice: outputPrice.error,
      cacheRead: cacheRead.error,
      cacheWrite: cacheWrite.error,
    }
    const cost = pick({
      input: inputPrice.value,
      output: outputPrice.value,
      cache_read: cacheRead.value,
      cache_write: cacheWrite.value,
    })
    const limit = pick({
      context: context.value,
      input: limitInput.value,
      output: output.value,
    })
    return {
      errors,
      value: [
        id,
        {
          name: modelName,
          ...(cost ? { cost } : {}),
          ...(limit ? { limit } : {}),
        },
      ] as const,
    }
  })
  const modelErrors = parsedModels.map((item) => item.errors)
  const modelsValid = modelErrors.every((item) => !hasErrors(item))
  const models = Object.fromEntries(parsedModels.map((item) => item.value))

  const seenHeaders = new Set<string>()
  const headerErrors = input.form.headers.map((h) => {
    const key = h.key.trim()
    const value = h.value.trim()

    if (!key && !value) return {}
    const keyError = !key
      ? input.t("provider.custom.error.required")
      : seenHeaders.has(key.toLowerCase())
        ? input.t("provider.custom.error.duplicate")
        : (() => {
            seenHeaders.add(key.toLowerCase())
            return undefined
          })()
    const valueError = !value ? input.t("provider.custom.error.required") : undefined
    return { key: keyError, value: valueError }
  })
  const headersValid = headerErrors.every((h) => !h.key && !h.value)
  const headers = Object.fromEntries(
    input.form.headers
      .map((h) => ({ key: h.key.trim(), value: h.value.trim() }))
      .filter((h) => !!h.key && !!h.value)
      .map((h) => [h.key, h.value]),
  )

  const errors: FormErrors = {
    providerID: idError ?? existsError,
    name: nameError,
    baseURL: urlError,
    models: modelErrors,
    headers: headerErrors,
  }

  const ok = !idError && !existsError && !nameError && !urlError && modelsValid && headersValid
  if (!ok) return { errors }

  return {
    errors,
    result: {
      providerID,
      name,
      key,
      config: {
        npm: OPENAI_COMPATIBLE,
        name,
        ...(env ? { env: [env] } : existingEnv ? { env: existingEnv } : {}),
        options: {
          baseURL,
          ...(Object.keys(headers).length ? { headers } : {}),
        },
        models,
      },
    },
  }
}
