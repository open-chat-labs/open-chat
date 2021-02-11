import { UserId } from "../../domain/model/users";

export const MARK_REMOTE_USER_ONLINE = "MARK_REMOTE_USER_ONLINE";

export default function(userId: UserId) : MarkRemoteUserOnlineEvent {
    return {
        type: MARK_REMOTE_USER_ONLINE,
        payload: userId
    };
}

export type MarkRemoteUserOnlineEvent = {
    type: typeof MARK_REMOTE_USER_ONLINE,
    payload: UserId
}
