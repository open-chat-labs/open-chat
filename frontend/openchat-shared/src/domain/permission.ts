import type { ExternalBotPermissions, SlashCommandParamInstance } from "./bots";
import type { ChatIdentifier, VideoCallType } from "./chat";
import type { CommunityIdentifier } from "./community";
import type { OptionUpdate } from "./optionUpdate";
import type { Failure, Success } from "./response";

export const allRoles = ["none", "owner", "admin", "moderator", "member"] as const;
export const chatRoles = allRoles;
type ChatRolesType = typeof allRoles;
export type ChatPermissionRole = ChatRolesType[number];
export type PermissionRole = ChatPermissionRole;

export const communityRoles = ["owner", "admin", "member"] as const;
type CommunityRolesType = typeof communityRoles;
export type CommunityPermissionRole = CommunityRolesType[number];

export type MemberRole = "admin" | "moderator" | "member" | "owner" | "none";

export const messagePermissionsList = [
    "text",
    "image",
    "video",
    "audio",
    "file",
    "poll",
    "crypto",
    "giphy",
    "prize",
    "memeFighter",
    "p2pSwap",
] as const;
type MessagePermissionsType = typeof messagePermissionsList;
export type MessagePermission = MessagePermissionsType[number];

export const chatPermissionsList = [
    "changeRoles",
    "updateGroup",
    "inviteUsers",
    "addMembers",
    "removeMembers",
    "deleteMessages",
    "pinMessages",
    "reactToMessages",
    "mentionAllMembers",
    "startVideoCall",
] as const;

export const communityPermissionsList = [
    "changeRoles",
    "updateDetails",
    "inviteUsers",
    "removeMembers",
    "createPublicChannel",
    "createPrivateChannel",
    "manageUserGroups",
] as const;

export type Permissioned<T> = {
    permissions: T;
};

export type HasMembershipRole = {
    membership: {
        role: MemberRole;
        lapsed: boolean;
    };
};

export type ChatPermissions = {
    changeRoles: ChatPermissionRole;
    updateGroup: ChatPermissionRole;
    inviteUsers: ChatPermissionRole;
    addMembers: ChatPermissionRole;
    removeMembers: ChatPermissionRole;
    deleteMessages: ChatPermissionRole;
    pinMessages: ChatPermissionRole;
    reactToMessages: ChatPermissionRole;
    mentionAllMembers: ChatPermissionRole;
    startVideoCall: ChatPermissionRole;
    messagePermissions: MessagePermissions;
    threadPermissions: MessagePermissions | undefined;
};

export type MessagePermissions = {
    default: ChatPermissionRole;
    text?: ChatPermissionRole;
    image?: ChatPermissionRole;
    video?: ChatPermissionRole;
    audio?: ChatPermissionRole;
    file?: ChatPermissionRole;
    poll?: ChatPermissionRole;
    crypto?: ChatPermissionRole;
    giphy?: ChatPermissionRole;
    prize?: ChatPermissionRole;
    memeFighter?: ChatPermissionRole;
    p2pSwap?: ChatPermissionRole;
};

export type OptionalChatPermissions = {
    changeRoles?: ChatPermissionRole;
    updateGroup?: ChatPermissionRole;
    inviteUsers?: ChatPermissionRole;
    addMembers?: ChatPermissionRole;
    removeMembers?: ChatPermissionRole;
    deleteMessages?: ChatPermissionRole;
    pinMessages?: ChatPermissionRole;
    reactToMessages?: ChatPermissionRole;
    mentionAllMembers?: ChatPermissionRole;
    startVideoCall?: ChatPermissionRole;
    messagePermissions: OptionalMessagePermissions | undefined;
    threadPermissions: OptionUpdate<OptionalMessagePermissions>;
};

export type OptionalMessagePermissions = {
    default: ChatPermissionRole | undefined;
    text: OptionUpdate<ChatPermissionRole>;
    image: OptionUpdate<ChatPermissionRole>;
    video: OptionUpdate<ChatPermissionRole>;
    audio: OptionUpdate<ChatPermissionRole>;
    file: OptionUpdate<ChatPermissionRole>;
    poll: OptionUpdate<ChatPermissionRole>;
    crypto: OptionUpdate<ChatPermissionRole>;
    giphy: OptionUpdate<ChatPermissionRole>;
    prize: OptionUpdate<ChatPermissionRole>;
    memeFighter: OptionUpdate<ChatPermissionRole>;
    p2pSwap: OptionUpdate<ChatPermissionRole>;
};

export type CommunityPermissions = {
    changeRoles: CommunityPermissionRole;
    updateDetails: CommunityPermissionRole;
    inviteUsers: CommunityPermissionRole;
    removeMembers: CommunityPermissionRole;
    createPublicChannel: CommunityPermissionRole;
    createPrivateChannel: CommunityPermissionRole;
    manageUserGroups: CommunityPermissionRole;
};

export function defaultOptionalChatPermissions(): OptionalChatPermissions {
    return {
        messagePermissions: undefined,
        threadPermissions: undefined,
    };
}

export function defaultOptionalMessagePermissions(): OptionalMessagePermissions {
    return {
        default: undefined,
        text: undefined,
        image: undefined,
        video: undefined,
        audio: undefined,
        file: undefined,
        poll: undefined,
        crypto: undefined,
        giphy: undefined,
        prize: undefined,
        memeFighter: undefined,
        p2pSwap: undefined,
    };
}

export type PermissionsByRole = Record<ChatPermissionRole, Set<string>>;

export type AccessTokenType = JoinVideoCall | StartVideoCall | BotActionByCommand;

export type JoinVideoCall = {
    kind: "join_video_call";
    chatId: ChatIdentifier;
};

export type StartVideoCall = {
    kind: "start_video_call";
    callType: VideoCallType;
    chatId: ChatIdentifier;
};

export type BotCommand = {
    initiator: string;
    commandName: string;
    arguments: SlashCommandParamInstance[];
};

export type BotActionChatScope = {
    kind: "chat_scope";
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    messageId: bigint;
};

export type BotActionCommunityScope = {
    kind: "community_scope";
    communityId: CommunityIdentifier;
};

export type BotActionScope = BotActionChatScope | BotActionCommunityScope;

export type BotActionByCommand = {
    kind: "bot_action_by_command";
    botId: string;
    command: BotCommand;
    scope: BotActionScope;
};

export type GenerateBotKeyResponse = (Success & { apiKey: string }) | Failure;

export type PublicApiKeyDetails = {
    botId: string;
    grantedPermissions: ExternalBotPermissions;
    generatedBy: string;
    generatedAt: bigint;
};
