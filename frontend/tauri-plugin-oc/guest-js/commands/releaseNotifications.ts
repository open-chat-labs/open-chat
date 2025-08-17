import { invoke } from "@tauri-apps/api/core";

export type DmNotifications = {
    kind: "dms";
    senderId: string;
};

export type GroupNotifications = {
    kind: "group";
    groupId: string;
    threadIndex?: number;
};

export type ChannelNotifications = {
    kind: "channel";
    communityId: string;
    channelId: number;
    threadIndex?: number;
};

export type NotificationIdentifier = DmNotifications | GroupNotifications | ChannelNotifications;

type ReleaseNotificationsRequest = {
    senderId?: string;
    groupdId?: string;
    communityId?: string;
    channelId?: number;
    threadIndex?: number;
};

function identifierToPayload(identifier: NotificationIdentifier): ReleaseNotificationsRequest {
    switch (identifier.kind) {
        case "dms":
            return { senderId: identifier.senderId };
        case "group":
            return {
                groupdId: identifier.groupId,
                threadIndex: identifier.threadIndex,
            };
        case "channel":
            return {
                communityId: identifier.communityId,
                channelId: identifier.channelId,
                threadIndex: identifier.threadIndex,
            };
    }
}

export async function releaseNotifications(identifier: NotificationIdentifier): Promise<void> {
    return await invoke<void>("plugin:oc|releaseNotifications", {
        payload: identifierToPayload(identifier),
    });
}
