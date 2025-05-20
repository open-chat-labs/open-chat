import { dequal } from "dequal";
import type {
    AccessGateConfig,
    ChatIdentifier,
    EventWrapper,
    Message,
    OptionalChatPermissions,
    OptionUpdate,
} from "openchat-shared";
import { revokeObjectUrls } from "../../utils/url";
import { ChatMapStore } from "../map";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

export class ChatSummaryUpdates {
    notificationsMuted?: boolean;
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

export class ChatSummaryUpdatesManager extends ChatMapStore<ChatSummaryUpdates> {
    #getOrCreate(id: ChatIdentifier): ChatSummaryUpdates {
        return this.get(id) ?? new ChatSummaryUpdates();
    }

    updateNotificationsMuted(id: ChatIdentifier, muted: boolean): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.notificationsMuted;
        state.notificationsMuted = muted;
        this.set(id, state);
        return scheduleUndo(() => {
            this.update(id, (val) => ({ ...val, notificationsMuted: previous }));
        });
    }

    updateArchived(id: ChatIdentifier, archived: boolean): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.archived;
        state.archived = archived;
        this.set(id, state);
        return scheduleUndo(() => {
            this.update(id, (val) => ({ ...val, archived: previous }));
        });
    }

    updateRulesAccepted(id: ChatIdentifier, rulesAccepted: boolean): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.rulesAccepted;
        state.rulesAccepted = rulesAccepted;
        this.set(id, state);
        return scheduleUndo(() => {
            this.update(id, (val) => ({ ...val, rulesAccepted: previous }));
        });
    }

    updateLatestMessage(id: ChatIdentifier, message: EventWrapper<Message>): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.latestMessage;
        if (!dequal(state.latestMessage, message)) {
            state.latestMessage = message;
            this.set(id, state);
            return scheduleUndo(() => {
                if (state.latestMessage !== undefined) {
                    revokeObjectUrls(state.latestMessage);
                }
                state.latestMessage = previous;
                this.update(id, (val) => ({ ...val, latestMessage: previous }));
            });
        }
        return () => {};
    }

    updateFrozen(id: ChatIdentifier, frozen: boolean): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.frozen;
        state.frozen = frozen;
        this.set(id, state);
        return scheduleUndo(() => {
            this.update(id, (val) => ({ ...val, frozen: previous }));
        });
    }

    updateChatProperties(
        id: ChatIdentifier,
        name?: string,
        description?: string,
        permissions?: OptionalChatPermissions,
        gateConfig?: AccessGateConfig,
        eventsTTL?: OptionUpdate<bigint>,
        isPublic?: boolean,
    ) {
        const state = this.#getOrCreate(id);
        const prevName = state.name;
        const prevDescription = state.description;
        const prevPermissions = state.permissions;
        const prevGateConfig = state.gateConfig;
        const prevEventsTTL = state.eventsTTL;
        const prevIsPublic = state.isPublic;

        state.name = name;
        state.description = description;
        state.permissions = permissions;
        state.gateConfig = gateConfig;
        state.eventsTTL = eventsTTL;
        state.isPublic = isPublic;
        this.set(id, state);

        return scheduleUndo(() => {
            this.update(id, (val) => ({
                ...val,
                name: prevName,
                description: prevDescription,
                permissions: prevPermissions,
                gateConfig: prevGateConfig,
                eventsTTL: prevEventsTTL,
                isPublic: prevIsPublic,
            }));
        });
    }
}

export const chatSummaryLocalUpdates = new ChatSummaryUpdatesManager();
