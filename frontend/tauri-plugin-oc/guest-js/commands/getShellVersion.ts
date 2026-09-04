import { invoke } from '@tauri-apps/api/core'

// The version of the web assets compiled into the installed binary, i.e. the
// version of the shell itself. Unlike window.OC_WEBSITE_VERSION this does not
// change when an OTA update is applied, so the two together tell you which
// native code is running underneath which web code.
export async function getShellVersion(): Promise<string | undefined> {
  return await invoke<string | null>('plugin:oc|get_shell_version').then((v) => v ?? undefined);
}
