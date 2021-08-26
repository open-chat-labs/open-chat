import { Dispatch } from "react";
import { RootState } from "../../reducers";
import chatsService from "../../services/chats/service";
import { ConfirmedChat } from "../../domain/model/chats";
import * as chatFunctions from "../../domain/model/chats";
import { ABOUT_US, PAGE_SIZE } from "../../constants";
import { Option, Timestamp } from "../../domain/model/common";
import { HttpError } from "../../errors/httpError";
import { ViewMode } from "../../domain/model/viewMode";
import { extractChatIdFromLocation } from "../../domain/historyFunctions";
import { UserId } from "../../domain/model/users";
import { alertDialog } from "../../components/modals/Alert";

export const GET_ALL_CHATS_REQUESTED = "GET_ALL_CHATS_REQUESTED";
export const GET_ALL_CHATS_SUCCEEDED = "GET_ALL_CHATS_SUCCEEDED";
export const GET_ALL_CHATS_FAILED = "GET_ALL_CHATS_FAILED";

export default function() {
    return async (dispatch: Dispatch<any>, getState: () => RootState) => {

        const requestEvent: GetAllChatsRequestedEvent = {
            type: GET_ALL_CHATS_REQUESTED
        };

        dispatch(requestEvent);

        const response = await chatsService.getUpdates({
            updatedSince: null,
            messageCountForTopChat: PAGE_SIZE
        });

        let outcomeEvent;
        if (response.kind === "success") {
            const viewMode = getState().appState.viewMode;
            const chats = response.chats;
            let chatIndex = (chats.length > 0 && viewMode === ViewMode.Desktop) ? 0 : null;
            const selectedChatId = extractChatIdFromLocation();
            if (selectedChatId != null) {
                const [ _, index ] = chatFunctions.tryGetChat(chats, selectedChatId);
                if (index >= 0) {
                    chatIndex = index;
                }
            }

            outcomeEvent = {
                type: GET_ALL_CHATS_SUCCEEDED,
                payload: {
                    chats: response.chats,
                    blockedUsers: response.blockedUsers,
                    latestUpdateTimestamp: response.latestUpdateTimestamp,
                    selectedChatIndex: chatIndex

                }
            } as GetAllChatsSucceededEvent;

            if (chats.length == 0) {
                alertDialog(ABOUT_US);
            }
        } else {
            outcomeEvent = {
                type: GET_ALL_CHATS_FAILED,
                httpError: response.kind === "httpError" ? response : undefined
            } as GetAllChatsFailedEvent;
        }

        dispatch(outcomeEvent);
    }
}

export type GetAllChatsRequestedEvent = {
    type: typeof GET_ALL_CHATS_REQUESTED
}

export type GetAllChatsSucceededEvent = {
    type: typeof GET_ALL_CHATS_SUCCEEDED,
    payload: {
        chats: ConfirmedChat[],
        blockedUsers: UserId[],
        latestUpdateTimestamp: Option<Timestamp>,
        selectedChatIndex: Option<number>
    }
}

export type GetAllChatsFailedEvent = {
    type: typeof GET_ALL_CHATS_FAILED,
    httpError?: HttpError
}
