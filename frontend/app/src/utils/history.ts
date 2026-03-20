// Adding a dummy stae
export function pushDummyHistoryState(action: string) {
    // Add dummy state only if it's not currently on the history stack
    if (!history.state.action || history.state.action !== action) {
        history.pushState({ action }, "");
    }
}

// Pop a state from history if it has a specific action property value!
export function popHistoryStateWithAction(action: string) {
    if (history.state.action === action) {
        history.back();
    }
}

export default {
    pushDummyHistoryState,
    popHistoryStateWithAction,
};
