export const GOTO_HOME = "GOTO_HOME";

export default function() {
    return { type: GOTO_HOME };
}

export type GotoHomeEvent = {
    type: typeof GOTO_HOME
}
