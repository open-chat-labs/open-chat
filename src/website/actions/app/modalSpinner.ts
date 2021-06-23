export const START_SPINNING = "START_SPINNING";
export const STOP_SPINNING = "STOP_SPINNING";

export function startSpinning() : StartSpinningEvent {
    return {
        type: START_SPINNING
    };
}

export function stopSpinning() : StopSpinningEvent {
    return {
        type: STOP_SPINNING
    };
}

export type StartSpinningEvent = {
    type: typeof START_SPINNING,
}

export type StopSpinningEvent = {
    type: typeof STOP_SPINNING,
}