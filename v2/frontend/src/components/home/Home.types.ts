export type HomeState =
    | "loadingChats"
    | "loadingMessages"
    | "idle"
    | "chatSelected"
    | "noChatSelected"
    | { error: string };
