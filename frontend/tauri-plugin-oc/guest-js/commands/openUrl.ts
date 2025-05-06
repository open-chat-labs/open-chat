import { invoke } from '@tauri-apps/api/core'

export type OpenUrlRequest = {
  url: string,
}

export type OpenUrlResponse = {
  value: string | null
}

export async function openUrl(payload: OpenUrlRequest): Promise<string | null> {
  return await invoke<OpenUrlResponse>('plugin:oc|open_url', {payload}).then((r) => (r.value ? r.value : null));
}
