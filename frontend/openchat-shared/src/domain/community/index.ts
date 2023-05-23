import type { DataContent } from "../data";

export type Community = DataContent & {
    id: string;
    name: string;
    description: string;
    memberCount: number;
    groupCount: number;
    unreadCount: number;
};
