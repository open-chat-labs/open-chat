import type { CommunityIdentifier } from "./community";

// TODO - don't love this
export type Level = "community" | "group" | "channel";

export type HasLevel = {
    level: Level;
};

export type ChatListScope = GroupScope | DirectScope | FavouriteScope | CommunityScope | NullScope;

export type GroupScope = { kind: "group_chat" };
export type DirectScope = { kind: "direct_chat" };
export type FavouriteScope = { kind: "favourite"; communityId?: CommunityIdentifier };
export type CommunityScope = { kind: "community"; id: CommunityIdentifier };
export type NullScope = { kind: "none" };
