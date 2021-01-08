export const CHAT_SELECTED = "CHAT_SELECTED";

export default function(index: number) {
    return {
        type: CHAT_SELECTED,
        payload: index
    };
}

export type ChatSelectedEvent = {
    type: typeof CHAT_SELECTED,
    payload: number
}
