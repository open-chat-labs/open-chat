import { ChatId } from "./chats";
import { Option } from "./common";

export type UserId = string;

export type MyProfile = {
    userId: UserId,
    username: string,
    accountBalance: bigint,
    imageId: Option<string>,
    imageBlobUrl: Option<string>,
    version: number
}

export type UserSummary = {
    userId: UserId,
    username: string,
    usernameLower: string,
    lastOnline: Date,
    minutesSinceLastOnline: number,
    imageId: Option<string>,
    chatId: ChatId,
    version: number
}

export type UserItem = {
    userId: UserId,
    username: string,
    usernameLower: string,
    imageId: Option<string>,
    isOnline: boolean,
    chatId: Option<ChatId>
}

export function fromMyProfile(myProfile: MyProfile): UserItem {
    return {
        userId: myProfile.userId,
        username: "You",
        usernameLower: "you",
        isOnline: true,
        imageId: myProfile.imageId,
        chatId: null
    };
}
export function fromUserSummary(user: UserSummary): UserItem {
    return {
        userId: user.userId,
        username: user.username,
        usernameLower: user.usernameLower,
        isOnline: user.minutesSinceLastOnline < 2,
        imageId: user.imageId,
        chatId: user.chatId
    };
}
