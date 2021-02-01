export const CHAT_SELECTED = "CHAT_SELECTED";

export default function(index: number) {
    return {
        type: CHAT_SELECTED,
        payload: index
    } as ChatSelectedEvent;
}

export type ChatSelectedEvent = {
    type: typeof CHAT_SELECTED,
    payload: number
}
