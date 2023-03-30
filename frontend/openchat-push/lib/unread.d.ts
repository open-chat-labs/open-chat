import type { EventWrapper, Message } from "openchat-shared";
export declare function getUnreadCount(latest: [string, EventWrapper<Message>], overwrite?: boolean): Promise<number | undefined>;
