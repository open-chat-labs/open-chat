import type { DataContent } from "../data";

export type Community = {
    id: string;
    name: string;
    description: string;
    memberCount: number;
    channelCount: number;
    unreadCount: number;
    avatar: DataContent;
    banner: DataContent;
};
