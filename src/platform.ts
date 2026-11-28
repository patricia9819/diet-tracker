// claude.ai Artifact 執行環境的小工具。不在 Claude 頁面裡時（例如 GitHub Pages），所有功能回傳 null。
/* eslint-disable @typescript-eslint/no-explicit-any */
type Use = (name: string) => Promise<any>

export function useCap<T = any>(name: string): Promise<T | null> {
  const c = (window as any).claude as { use?: Use } | undefined
  if (!c?.use) return Promise.resolve(null)
  return c.use(name).catch(() => null)
}

export interface SampleFn {
  (input: string, opts?: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>
  json<T = unknown>(input: string, opts?: Record<string, unknown>): Promise<T>
  limits(): Promise<{ images?: { maxCount: number; mediaTypes: string[] } }>
}
