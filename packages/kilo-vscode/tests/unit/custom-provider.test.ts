import { describe, expect, it } from "bun:test"
import {
  parseCustomProviderSecret,
  sanitizeCustomProviderConfig,
  validateProviderID,
} from "../../src/shared/custom-provider"
import { modelRow, validateCustomProvider } from "../../webview-ui/src/components/settings/custom-provider-form"

describe("validateProviderID", () => {
  it("accepts valid provider ids", () => {
    expect(validateProviderID(" my-provider_1 ")).toEqual({ value: "my-provider_1" })
  })

  it("rejects invalid provider ids", () => {
    const result = validateProviderID("bad/id")
    expect("error" in result ? result.error : "").toBe("Invalid provider ID")
  })
})

describe("parseCustomProviderSecret", () => {
  it("treats plain values as api keys", () => {
    expect(parseCustomProviderSecret(" sk-test ")).toEqual({ value: { apiKey: "sk-test" } })
  })

  it("parses env references", () => {
    expect(parseCustomProviderSecret(" {env:MY_PROVIDER_KEY} ")).toEqual({ value: { env: "MY_PROVIDER_KEY" } })
  })

  it("rejects invalid env references", () => {
    const result = parseCustomProviderSecret("{env:bad-name}")
    expect("error" in result ? result.error : "").toBe("Invalid environment variable name")
  })
})

describe("sanitizeCustomProviderConfig", () => {
  it("normalizes config and forces the approved package", () => {
    const result = sanitizeCustomProviderConfig({
      npm: "malicious-package",
      name: " My Provider ",
      env: [" MY_PROVIDER_KEY "],
      options: {
        baseURL: "https://example.com/v1 ",
        headers: {
          Authorization: " Bearer test ",
          " X-Test ": " 123 ",
        },
      },
      models: {
        " model-1 ": { name: " Model One " },
      },
    })

    expect(result).toEqual({
      value: {
        npm: "@ai-sdk/openai-compatible",
        name: "My Provider",
        env: ["MY_PROVIDER_KEY"],
        options: {
          baseURL: "https://example.com/v1",
          headers: {
            Authorization: "Bearer test",
            "X-Test": "123",
          },
        },
        models: {
          "model-1": { name: "Model One" },
        },
      },
    })
  })

  it("preserves per-model cost and limit metadata", () => {
    const result = sanitizeCustomProviderConfig({
      name: "My Provider",
      options: {
        baseURL: "https://example.com/v1",
      },
      models: {
        " model-1 ": {
          name: " Model One ",
          cost: {
            input: 2.5,
            output: 10,
          },
          limit: {
            context: 200_000,
            output: 8_192,
          },
        },
      },
    })

    expect(result).toEqual({
      value: {
        npm: "@ai-sdk/openai-compatible",
        name: "My Provider",
        options: {
          baseURL: "https://example.com/v1",
        },
        models: {
          "model-1": {
            name: "Model One",
            cost: {
              input: 2.5,
              output: 10,
            },
            limit: {
              context: 200_000,
              output: 8_192,
            },
          },
        },
      },
    })
  })

  it("rejects invalid model metadata", () => {
    const result = sanitizeCustomProviderConfig({
      name: "Bad Provider",
      options: {
        baseURL: "https://example.com/v1",
      },
      models: {
        "model-1": {
          name: "Model One",
          cost: {
            input: -1,
          },
        },
      },
    })

    expect("error" in result).toBe(true)
    if (!("error" in result)) return
    expect(result.issue?.path).toEqual(["models", "model-1", "cost", "input"])
  })

  it("rejects unknown fields", () => {
    const result = sanitizeCustomProviderConfig({
      name: "Bad Provider",
      options: {
        baseURL: "https://example.com/v1",
        mcpServer: "https://malicious.example",
      },
      models: { "model-1": { name: "Model One" } },
    })

    expect("error" in result ? result.error : "").toContain("mcpServer")
  })
})

describe("validateCustomProvider", () => {
  const t = (key: string) => key

  it("applies legacy-aligned defaults for blank advanced fields", () => {
    const row = modelRow("model-1", "Model One")

    expect(row.context).toBe("128000")
    expect(row.output).toBe("4096")
    expect(row.inputPrice).toBe("0")
    expect(row.outputPrice).toBe("0")
  })

  it("keeps advanced settings collapsed for default edit values", () => {
    expect(
      modelRow("model-1", "Model One", {
        name: "Model One",
        limit: {
          context: 128000,
          output: 4096,
        },
        cost: {
          input: 0,
          output: 0,
        },
      }).open,
    ).toBe(false)
  })

  it("expands advanced settings for edited override values", () => {
    expect(
      modelRow("model-1", "Model One", {
        name: "Model One",
        limit: {
          context: 200000,
          output: 4096,
        },
      }).open,
    ).toBe(true)
  })

  it("includes custom cost and context metadata in the saved config", () => {
    const result = validateCustomProvider({
      form: {
        providerID: "my-provider",
        name: "My Provider",
        baseURL: "https://example.com/v1",
        apiKey: "",
        models: [
          {
            id: "model-1",
            name: "Model One",
            context: "200000",
            input: "",
            output: "8192",
            inputPrice: "3",
            outputPrice: "15",
            cacheRead: "",
            cacheWrite: "",
            open: true,
          },
        ],
        headers: [{ key: "", value: "" }],
        saving: false,
      },
      t,
      editing: false,
      disabledProviders: [],
      existingProviderIDs: new Set(),
    })

    expect(result.result).toEqual({
      providerID: "my-provider",
      name: "My Provider",
      key: undefined,
      config: {
        npm: "@ai-sdk/openai-compatible",
        name: "My Provider",
        options: {
          baseURL: "https://example.com/v1",
        },
        models: {
          "model-1": {
            name: "Model One",
            cost: {
              input: 3,
              output: 15,
            },
            limit: {
              context: 200000,
              output: 8192,
            },
          },
        },
      },
    })
  })

  it("includes input and cache overrides in the saved config", () => {
    const result = validateCustomProvider({
      form: {
        providerID: "my-provider",
        name: "My Provider",
        baseURL: "https://example.com/v1",
        apiKey: "",
        models: [
          {
            id: "model-1",
            name: "Model One",
            context: "128000",
            input: "64000",
            output: "4096",
            inputPrice: "0",
            outputPrice: "0",
            cacheRead: "0.5",
            cacheWrite: "1.25",
            open: true,
          },
        ],
        headers: [{ key: "", value: "" }],
        saving: false,
      },
      t,
      editing: false,
      disabledProviders: [],
      existingProviderIDs: new Set(),
    })

    expect(result.result?.config.models["model-1"]).toEqual({
      name: "Model One",
      cost: {
        input: 0,
        output: 0,
        cache_read: 0.5,
        cache_write: 1.25,
      },
      limit: {
        context: 128000,
        input: 64000,
        output: 4096,
      },
    })
  })

  it("rejects invalid advanced model values", () => {
    const result = validateCustomProvider({
      form: {
        providerID: "my-provider",
        name: "My Provider",
        baseURL: "https://example.com/v1",
        apiKey: "",
        models: [
          {
            id: "model-1",
            name: "Model One",
            context: "0",
            input: "",
            output: "4096",
            inputPrice: "-1",
            outputPrice: "15",
            cacheRead: "",
            cacheWrite: "",
            open: true,
          },
        ],
        headers: [{ key: "", value: "" }],
        saving: false,
      },
      t,
      editing: false,
      disabledProviders: [],
      existingProviderIDs: new Set(),
    })

    expect(result.result).toBeUndefined()
    expect(result.errors.models[0]).toEqual({
      id: undefined,
      name: undefined,
      context: "provider.custom.error.positiveInteger",
      input: undefined,
      output: undefined,
      inputPrice: "provider.custom.error.nonNegativeNumber",
      outputPrice: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    })
  })
})
