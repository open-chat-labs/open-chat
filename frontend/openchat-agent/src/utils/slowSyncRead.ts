/**
 * Where a sync read (`ChatsDb.getChatsForSync` and the answer built from it) has got to:
 * - "opening": waiting for the database connection
 * - "waiting": the transaction is created but its first read hasn't answered, so it is most likely
 *   queued behind a readwrite transaction on the same stores
 * - "reading": the reads themselves
 * - "building": the transaction is done and the answer is being built from what it read
 */
export type SyncReadPhase = "opening" | "waiting" | "reading" | "building";

export const SYNC_READ_SLOW_MS = 10_000;

/**
 * Runs `read`, which moves through the phases by calling `setPhase`. If it hasn't settled after
 * `slowMs`, `report` is called once with the phase it is in, so a read that never finishes is
 * still seen, and which phase it stuck in says whether it waited on another transaction.
 */
export async function reportIfSlow<T>(
    read: (setPhase: (phase: SyncReadPhase) => void) => Promise<T>,
    report: (phase: SyncReadPhase, slowMs: number) => void,
    slowMs: number = SYNC_READ_SLOW_MS,
): Promise<T> {
    let phase: SyncReadPhase = "opening";
    const timer = setTimeout(() => report(phase, slowMs), slowMs);
    try {
        return await read((p) => (phase = p));
    } finally {
        clearTimeout(timer);
    }
}
