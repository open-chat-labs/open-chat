export type UserId = string;

export type MyProfile = {
    userId: UserId,
    username: string,
    accountBalance: bigint,
    version: number
}

export type UserSummary = {
    userId: UserId,
    username: string,
    lastOnline: Date,
    minutesSinceLastOnline: number,
    version: number
}
