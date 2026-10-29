/**
 * The demo request scope. Code running inside it is serving a demo request:
 * its database calls go to the in-memory demo database and every outside
 * service is simulated (see intercept.ts). Outside it, nothing changes.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

export type DemoLogEntry = { at: string; kind: 'email' | 'meeting' | 'scan' | 'payment' | 'invoice' | 'blocked' | 'note'; summary: string; detail?: Record<string, unknown> }

export type DemoScope = {
  /** Runs SQL against this request's demo database. */
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  storage: Map<string, { type: string; data: Buffer }>
  log: DemoLogEntry[]
}

// One instance per process, even if this module is loaded again (development
// hot reload), so the fetch hook in intercept.ts always sees the current scope.
const g = globalThis as typeof globalThis & { __demoScope?: AsyncLocalStorage<DemoScope> }
export const demoScope = (g.__demoScope ??= new AsyncLocalStorage<DemoScope>())

export const inDemoScope = () => demoScope.getStore() !== undefined
