import type { Level, MessageFormatter, InterpolationValues } from "openchat-client";
import { format } from "svelte-i18n";

let formatter: MessageFormatter | undefined;

format.subscribe((f) => (formatter = f));

export function interpolateLevel(
    key: string,
    level: Level,
    lowercase = false,
    values: InterpolationValues = {}
): string {
    if (formatter === undefined) return key;
    const levelTxt = formatter(`level.${level}`);
    const v = values ?? {};
    return formatter(key, {
        values: { ...v, level: lowercase ? levelTxt.toLowerCase() : levelTxt },
    });
}
