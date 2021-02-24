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
    lastOnline: Date,
    minutesSinceLastOnline: number,
    imageId: Option<string>,
    version: number
}

export type UserItem = {
    userId: UserId,
    username: string,
    imageId: Option<string>,
    isOnline: boolean
}

export function fromMyProfile(myProfile: MyProfile): UserItem {
    return {
        userId: myProfile.userId,
        username: "You",
        isOnline: true,
        imageId: myProfile.imageId
    };
}
export function fromUserSummary(user: UserSummary): UserItem {
    return {
        userId: user.userId,
        username: user.username,
        isOnline: user.minutesSinceLastOnline < 2,
        imageId: user.imageId
    };
}
