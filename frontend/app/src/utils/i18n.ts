import type { Level, MessageFormatter } from "openchat-client";
import { format } from "svelte-i18n";

let formatter: MessageFormatter | undefined;

format.subscribe((f) => (formatter = f));

export function interpolateLevel(key: string, level: Level, lowercase = false): string {
    if (formatter === undefined) return key;
    const levelTxt = formatter(`level.${level}`);
    return formatter(key, { values: { level: lowercase ? levelTxt.toLowerCase() : levelTxt } });
}
