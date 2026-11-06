/**
 * One of a palette's entries, picked by an id's hash, so an id always gets the same one: the
 * design's colour swatches for things that have no colour of their own (chats, communities).
 */
export function pickById<T>(id: string, palette: readonly T[]): T {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return palette[Math.abs(hash) % palette.length];
}
