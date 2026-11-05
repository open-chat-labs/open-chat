// A push as the native shell hands it to the web layer, the same shape on Android and iOS
export type PushNotification = {
    id: number;
    type: "DM" | "GROUP" | "CHANNEL";
    senderId?: string;
    groupId?: string;
    communityId?: string;
    channelId?: number;
    threadIndex?: number;
};

/**
 * Whether a push that arrives while the app is open is for the chat on screen, in which case it
 * isn't shown. A chat on screen covers its threads too.
 */
export function chatOnScreen(notification: PushNotification, pathname: string): boolean {
    const within = (chatPath: string) =>
        pathname === chatPath || pathname.startsWith(`${chatPath}/`);
    switch (notification.type) {
        case "DM":
            return within(`/user/${notification.senderId}`);
        case "GROUP":
            return within(`/group/${notification.groupId}`);
        case "CHANNEL":
            return within(`/community/${notification.communityId}/channel/${notification.channelId}`);
        default:
            return false;
    }
}
