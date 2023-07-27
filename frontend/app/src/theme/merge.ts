/* eslint-disable @typescript-eslint/ban-types */
import type { Theme } from "./types";

type Subset<K> = {
    [attr in keyof K]?: K[attr] extends object ? Subset<K[attr]> : K[attr];
};

export type PartialTheme = Subset<Theme>;

export function deepMerge<T extends object>(target: T, source: Subset<T>): T {
    const merged: T = { ...target };

    for (const key in source) {
        const k = key as keyof T;
        const val = source[k];
        if (typeof val === "object" && val !== undefined) {
            merged[k] = deepMerge(merged[k], val);
        } else {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            merged[k] = source[k];
        }
    }

    return merged;
}
