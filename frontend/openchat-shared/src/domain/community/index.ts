import type { Gated } from "../access";
import type { DataContent } from "../data";

export type Community = Gated & {
    id: string;
    name: string;
    description: string;
    memberCount: number;
    channelCount: number;
    unreadCount: number;
    avatar: DataContent;
    banner: DataContent;
    isPublic: boolean;
};
