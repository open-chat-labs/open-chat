// import type { ChatSummary, ChatPermissions, MultiUserChatIdentifier } from "openchat-client";
// import { writable } from "svelte/store";

// export type RightPanelState =
//     | GroupDetailsPanel
//     | InviteGroupMembersPanel
//     | InviteCommunityMembers
//     | ShowGroupMembersPanel
//     | ShowCommunityMembers
//     | ShowPinnedPanel
//     | UserProfilePanel
//     | MessageThreadPanel
//     | ProposalFilterPanel
//     | CommunityFilters
//     | CommunityDetails
//     | CallParticipantsPanel
//     | NoPanel;

// export type NoPanel = {
//     kind: "no_panel";
// };

// export type MessageThreadPanel = {
//     kind: "message_thread_panel";
//     threadRootMessageIndex: number;
//     threadRootMessageId: bigint;
// };

// export type GroupDetailsPanel = {
//     kind: "group_details";
// };

// export type UserProfilePanel = {
//     kind: "user_profile";
// };

// export type InviteGroupMembersPanel = {
//     kind: "invite_group_users";
// };

// export type InviteCommunityMembers = {
//     kind: "invite_community_users";
// };

// export type ShowGroupMembersPanel = {
//     kind: "show_group_members";
// };

// export type CommunityDetails = {
//     kind: "community_details";
// };

// export type ShowCommunityMembers = {
//     kind: "show_community_members";
//     userGroupId?: number;
// };

// export type CallParticipantsPanel = {
//     kind: "call_participants_panel";
//     chatId: MultiUserChatIdentifier;
//     messageId: bigint;
//     isOwner: boolean;
// };

// export type ShowPinnedPanel = {
//     kind: "show_pinned";
// };

// export type ProposalFilterPanel = {
//     kind: "proposal_filters";
// };

// export type CommunityFilters = {
//     kind: "community_filters";
// };

// export type UpdatedAvatar = {
//     blobUrl?: string;
//     blobData?: Uint8Array;
// };

// export type UpdatedGroup = {
//     name: string;
//     desc: string;
//     avatar?: UpdatedAvatar;
//     permissions: ChatPermissions;
// };

// function createRightPanelHistoryStore() {
//     const store = writable<RightPanelState[]>([]);
//     let storeValue: RightPanelState[] = [];
//     store.subscribe((v) => (storeValue = v));

//     function set(states: RightPanelState[]) {
//         // optimise the empty case
//         if (states.length === 0 && storeValue.length === 0) {
//             return;
//         }
//         return store.set(states);
//     }

//     function filter(fn: (state: RightPanelState) => boolean) {
//         return set(storeValue.filter(fn));
//     }

//     return {
//         subscribe: store.subscribe,
//         update: store.update,
//         set,
//         filter,
//         filterByChatType: (chat: ChatSummary | undefined) => {
//             if (chat === undefined) return;

//             return filter((p) => {
//                 if (chat.kind === "direct_chat") {
//                     return ["new_group_panel", "user_profile"].includes(p.kind);
//                 }
//                 if (
//                     chat.kind === "group_chat" &&
//                     (chat.previewed ||
//                         (!(chat.subtype?.isNns ?? false) && p.kind === "proposal_filters"))
//                 ) {
//                     return false;
//                 }
//                 return true;
//             });
//         },
//         pop: () => store.update((history) => history.slice(0, history.length - 1)),
//         push: (state: RightPanelState) => store.update((history) => [...history, state]),
//     };
// }
// export const rightPanelHistory = createRightPanelHistoryStore();
