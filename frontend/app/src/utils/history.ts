let previousState: CustomHistoryState | undefined = undefined;

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

// Adding a dummy stae
export function pushDummyHistoryState(action: CustomHistoryAction, allowNesting = false) {
    previousState = { ...history.state, action };
    if (allowNesting) {
        history.pushState(previousState, "");
    } else if (!history.state.action || history.state.action !== action) {
        history.pushState(previousState, "");
    }
}

// Pop a state from history if it has a specific action property value!
export function popHistoryStateWithAction(action: CustomHistoryAction): boolean {
    if (history.state.action === action) {
        history.back();
        return true;
    }
    return false;
}

export function onPopstate(_: PopStateEvent): {
    previousState?: CustomHistoryState;
    currentState?: unknown;
} {
    const prev = previousState;
    previousState = history.state;
    return {
        previousState: prev,
        currentState: history.state,
    };
}
