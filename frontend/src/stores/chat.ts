export type ChatState = {
    chatId: string;
    event: ChatLifecycleEvent;
};

export type ChatLifecycleEvent =
    | Nothing
    | LoadedNewMessages
    | SendingMessage
    | ChatUpdated
    | LoadedEventWindow
    | LoadedPreviousMessages;

type Nothing = { kind: "nothing" };
type LoadedNewMessages = { kind: "loaded_new_messages" };
type SendingMessage = {
    kind: "sending_message";
    scroll: ScrollBehavior;
};
type ChatUpdated = { kind: "chat_updated" };
type LoadedPreviousMessages = { kind: "loaded_previous_messages" };
type LoadedEventWindow = {
    kind: "loaded_event_window";
    messageIndex: number;
    preserveFocus: boolean;
    allowRecursion: boolean;
};
