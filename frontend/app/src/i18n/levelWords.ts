import type { Level, MessageFormatter, ResourceKey } from "@client";

/**
 * Which words fill a message's {level}:
 * - "level": the old trees' `level.*`. They are capitalised and lower-cased in code, which is wrong
 *   for some languages (German nouns keep their capital; French `level.channel` is a verb), but the
 *   old trees keep showing exactly what they always have.
 * - "levelNoun": the new UIs' `levelNoun.*`, stored as the noun reads mid-sentence and only
 *   capitalised (first letter) where a key asks for the capitalised form.
 */
export type LevelWords = "level" | "levelNoun";

/** The word for a level, as a message's {level} wants it: mid-sentence (`lowercase`) or capitalised. */
export function levelWord(
    formatter: MessageFormatter,
    level: Level,
    lowercase: boolean,
    words: LevelWords,
): string {
    if (words === "level") {
        const text = formatter(`level.${level}`);
        return lowercase ? text.toLowerCase() : text;
    }
    const noun = formatter(`levelNoun.${level}`);
    return lowercase ? noun : noun.charAt(0).toUpperCase() + noun.slice(1);
}

/** A resource key's text, with its {level} (if it has one) in the given words. */
export function interpolateWith(
    formatter: MessageFormatter,
    { key, params, level, lowercase }: ResourceKey,
    words: LevelWords,
): string {
    if (level !== undefined) {
        return formatter(key, {
            values: { ...(params ?? {}), level: levelWord(formatter, level, lowercase, words) },
        });
    }
    const result = formatter(key, { values: params });
    if (typeof result !== "string") {
        return key;
    }
    return result;
}
