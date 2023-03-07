export interface IOnlineClient {
    lastOnline(userIds: string[]): Promise<Record<string, number>>
    markAsOnline(): Promise<void>;
}
