import type { CommunityIdentifier } from "./community";

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

export function chatListScopesEqual(a: ChatListScope, b: ChatListScope): boolean {
    if (a.kind !== a.kind) return false;
    switch (a.kind) {
        case "community":
            return b.kind === "community" && b.id.communityId === a.id.communityId;
        case "favourite":
            return (
                b.kind === "favourite" && b.communityId?.communityId === a.communityId?.communityId
            );
        default:
            return true;
    }
}
