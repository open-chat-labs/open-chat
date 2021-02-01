export type UserId = string;

export type UserSummary = {
    userId: UserId,
    username: string,
    lastOnline: Date,
    minutesSinceLastOnline: number,
    version: number
}
