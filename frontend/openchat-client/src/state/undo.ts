export type UndoLocalUpdate = () => void;

const TIMEOUT = 30_000;

export function scheduleUndo(fn: UndoLocalUpdate): UndoLocalUpdate {
    const timer = setTimeout(fn, TIMEOUT);
    return () => {
        // if someone calls the undo fn manually, we can cancel the
        // scheduled call
        clearTimeout(timer);
        fn();
    };
}
