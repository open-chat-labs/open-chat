import { Dispatch } from "react";
import { ChatId } from "../../domain/model/chats";
import chatsService from "../../services/chats/service";

export const NOTIFICATIONS_MUTED = "NOTIFICATIONS_MUTED";
export const NOTIFICATIONS_UNMUTED = "NOTIFICATIONS_UNMUTED";

export function toggleNotifications(chatId: ChatId, mute: boolean) {
    return async (dispatch: Dispatch<any>) : Promise<void> => {
        let event: NotificationsMutedEvent | NotificationsUnmutedEvent = {
            type: mute ? NOTIFICATIONS_MUTED : NOTIFICATIONS_UNMUTED,
            payload: {
                chatId
            }
        };
        dispatch(event);
        
        await chatsService.toggle_notifications(chatId, mute);
    }
}

export type NotificationsMutedEvent = {
    type: typeof NOTIFICATIONS_MUTED,
    payload: {
        chatId: ChatId,
    }
}

export type NotificationsUnmutedEvent = {
    type: typeof NOTIFICATIONS_UNMUTED,
    payload: {
        chatId: ChatId,
    }
}
