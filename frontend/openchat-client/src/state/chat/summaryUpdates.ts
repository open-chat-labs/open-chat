import {
    ChatMap,
    type AccessGateConfig,
    type EventWrapper,
    type Message,
    type OptionalChatPermissions,
    type OptionUpdate,
} from "openchat-shared";
import { writable } from "../../utils/stores";
import { notEq } from "../utils";

export class ChatSummaryUpdates {
    notificationsMuted?: boolean;
    atEveryoneMuted?: boolean;
    archived?: boolean;
    rulesAccepted?: boolean;
    latestMessage?: EventWrapper<Message>;
    frozen?: boolean;
    name?: string;
    description?: string;
    permissions?: OptionalChatPermissions;
    gateConfig?: AccessGateConfig;
    eventsTTL?: OptionUpdate<bigint>;
    isPublic?: boolean;
}

export const chatSummaryLocalUpdates = writable<ChatMap<ChatSummaryUpdates>>(
    new ChatMap(),
    undefined,
    notEq,
);
