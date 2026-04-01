import { Effect, ManagedRuntime } from "effect"
import z from "zod"

import { fn } from "@/util/fn"
import { Telemetry } from "@kilocode/kilo-telemetry" // kilocode_change
import { ModelCache } from "./model-cache" // kilocode_change
import { Auth } from "@/auth" // kilocode_change
import * as S from "./auth-service"
import { ProviderID } from "./schema"

// Separate runtime: ProviderAuthService can't join the shared runtime because
// runtime.ts → auth-service.ts → provider/auth.ts creates a circular import.
// AuthService is stateless file I/O so the duplicate instance is harmless.
const rt = ManagedRuntime.make(S.ProviderAuthService.defaultLayer)

function runPromise<A>(f: (service: S.ProviderAuthService.Service) => Effect.Effect<A, S.ProviderAuthError>) {
  return rt.runPromise(S.ProviderAuthService.use(f))
}

export namespace ProviderAuth {
  export const Method = S.Method
  export type Method = S.Method

  export async function methods() {
    return runPromise((service) => service.methods())
  }

  export const Authorization = S.Authorization
  export type Authorization = S.Authorization

  export const authorize = fn(
    z.object({
      providerID: ProviderID.zod,
      method: z.number(),
    }),
    async (input): Promise<Authorization | undefined> => runPromise((service) => service.authorize(input)),
  )

  export const callback = fn(
    z.object({
      providerID: ProviderID.zod,
      method: z.number(),
      code: z.string().optional(),
    }),
    async (input) => {
      await runPromise((service) => service.callback(input))
      // kilocode_change start - Update telemetry identity on Kilo auth
      if (input.providerID === "kilo") {
        const auth = await Auth.get(input.providerID)
        if (auth) {
          const token = auth.type === "oauth" ? auth.access : auth.type === "api" ? auth.key : null
          const accountId = auth.type === "oauth" ? auth.accountId : undefined
          await Telemetry.updateIdentity(token, accountId)
        }
      }
      Telemetry.trackAuthSuccess(input.providerID)
      // kilocode_change end
      // kilocode_change start - invalidate provider/model cache after auth change
      ModelCache.clear(input.providerID)
      // kilocode_change end
    },
  )

  export const api = fn(
    z.object({
      providerID: ProviderID.zod,
      key: z.string(),
    }),
    async (input) => {
      await runPromise((service) => service.api(input))
      // kilocode_change start - invalidate provider/model cache after auth change
      ModelCache.clear(input.providerID)
      // kilocode_change end
    },
  )

  export import OauthMissing = S.OauthMissing
  export import OauthCodeMissing = S.OauthCodeMissing
  export import OauthCallbackFailed = S.OauthCallbackFailed
}
