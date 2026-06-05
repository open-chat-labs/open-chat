type CustomHistoryState = {
    action: CustomHistoryAction;
};

export type CustomHistoryAction =
    | "sliding_modal"
    | "emoji_picker_action"
    | "zoomed_image_state"
    | "zoomed_video_state"
    | "input-tray-message"
    | "input-tray-thread";

let currentHistoryState: unknown = typeof history === "undefined" ? undefined : history.state;
const popstateCache = new WeakMap<
    PopStateEvent,
    {
        previousState?: CustomHistoryState;
        previousAction?: CustomHistoryAction;
        currentState?: unknown;
    }
>();

export function getHistoryStateAction(state: unknown): CustomHistoryAction | undefined {
    if (state && typeof state === "object" && "action" in state) {
        return (state as { action?: CustomHistoryAction }).action;
    }
    return undefined;
}

export function syncCurrentHistoryState(state: unknown = history.state) {
    currentHistoryState = state;
}

// Adding a dummy state
export function pushDummyHistoryState(action: CustomHistoryAction, allowNesting = false) {
    const nextState = { ...(history.state ?? {}), action };
    if (allowNesting || getHistoryStateAction(history.state) !== action) {
        history.pushState(nextState, "");
        syncCurrentHistoryState(nextState);
    }
}

// Pop a state from history if it has a specific action property value!
export function popHistoryStateWithAction(action: CustomHistoryAction): boolean {
    if (getHistoryStateAction(history.state) === action) {
        history.back();
        return true;
    }
    return false;
}

export function onPopstate(event: PopStateEvent): {
    previousState?: CustomHistoryState;
    previousAction?: CustomHistoryAction;
    currentState?: unknown;
} {
    const cached = popstateCache.get(event);
    if (cached) {
        return cached;
    }

    const previousAction = getHistoryStateAction(currentHistoryState);
    const result = {
        previousState:
            previousAction === undefined
                ? undefined
                : ({ action: previousAction } as CustomHistoryState),
        previousAction,
        currentState: history.state,
    };

    syncCurrentHistoryState(history.state);
    popstateCache.set(event, result);
    return result;
}
