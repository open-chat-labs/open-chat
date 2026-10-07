import type { CommunityIdentifier, GroupChatIdentifier } from "@client";

export type UnfreezeTarget =
    | { kind: "group"; id: GroupChatIdentifier }
    | { kind: "community"; id: CommunityIdentifier };

// What unfreezing from a frozen chat's preview acts on: the group itself, or the community a channel is in.
export function unfreezeTarget(
    chat: { kind: "group_chat"; id: GroupChatIdentifier } | { kind: "channel" },
    selectedCommunityId: CommunityIdentifier | undefined,
): UnfreezeTarget | undefined {
    switch (chat.kind) {
        case "group_chat":
            return { kind: "group", id: chat.id };
        case "channel":
            return selectedCommunityId === undefined
                ? undefined
                : { kind: "community", id: selectedCommunityId };
    }
}
