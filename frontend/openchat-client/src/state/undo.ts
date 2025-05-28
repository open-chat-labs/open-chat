export type UndoLocalUpdate = () => void;

const TIMEOUT = 60_000;

export function scheduleUndo(
    fn: UndoLocalUpdate,
    dedupeId: string | undefined = undefined,
    timeout: number | "never" = TIMEOUT,
): UndoLocalUpdate {
    if (timeout === "never") return fn;

    const wrappedFn = dedupeId !== undefined ? dedupe(fn, dedupeId) : fn;

    const timer = setTimeout(wrappedFn, timeout);

    return () => {
        // if someone calls the undo fn manually, cancel the scheduled call
        clearTimeout(timer);
        wrappedFn();
    };
}

function dedupe(fn: UndoLocalUpdate, dedupeId: string): UndoLocalUpdate {
    const symbol = Symbol();
    undoMap.set(dedupeId, symbol);
    return () => {
        if (undoMap.get(dedupeId) === symbol) {
            undoMap.delete(dedupeId);
            fn();
        }
    };
}

const undoMap = new Map<string, symbol>();
