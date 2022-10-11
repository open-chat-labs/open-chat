import type { EventsResponse, UpdateArgs, CandidateGroupChat, CreateGroupResponse, DeleteGroupResponse, DirectChatEvent, MergedUpdatesResponse, SendMessageResponse, BlockUserResponse, UnblockUserResponse, LeaveGroupResponse, MarkReadResponse, Message, IndexRange, AddRemoveReactionResponse, DeleteMessageResponse, JoinGroupResponse, EditMessageResponse, MarkReadRequest, GroupChatSummary, WithdrawCryptocurrencyResponse, PendingCryptocurrencyWithdrawal, CurrentChatState } from "../../domain/chat/chat";
import type { IUserClient } from "./user.client.interface";
import { Database } from "../../utils/caching";
import type { BlobReference } from "../../domain/data/data";
import type { ArchiveChatResponse, CreatedUser, MigrateUserPrincipalResponse, PinChatResponse, PublicProfile, SetBioResponse, UnpinChatResponse } from "../../domain/user/user";
import type { SearchDirectChatResponse, SearchAllMessagesResponse } from "../../domain/search/search";
import type { ToggleMuteNotificationResponse } from "../../domain/notifications";
import type { Identity } from "@dfinity/agent";
import type { GroupInvite } from "../../services/serviceContainer";
import type { ServiceRetryInterrupt } from "services/candidService";
/**
 * This exists to decorate the user client so that we can provide a write through cache to
 * indexDB for holding chat messages
 */
export declare class CachingUserClient implements IUserClient {
    private db;
    private identity;
    private client;
    private groupInvite;
    get userId(): string;
    constructor(db: Database, identity: Identity, client: IUserClient, groupInvite: GroupInvite | undefined);
    private setCachedChats;
    private setCachedEvents;
    private handleMissingEvents;
    chatEventsByIndex(eventIndexes: number[], userId: string, threadRootMessageIndex: number | undefined, latestClientEventIndex: number | undefined): Promise<EventsResponse<DirectChatEvent>>;
    chatEventsWindow(eventIndexRange: IndexRange, userId: string, messageIndex: number, latestClientEventIndex: number | undefined, interrupt?: ServiceRetryInterrupt): Promise<EventsResponse<DirectChatEvent>>;
    chatEvents(eventIndexRange: IndexRange, userId: string, startIndex: number, ascending: boolean, threadRootMessageIndex: number | undefined, latestClientEventIndex: number | undefined, interrupt?: ServiceRetryInterrupt): Promise<EventsResponse<DirectChatEvent>>;
    private primeCaches;
    getInitialState(selectedChatId: string | undefined): Promise<MergedUpdatesResponse>;
    getUpdates(currentState: CurrentChatState, args: UpdateArgs, selectedChatId: string | undefined): Promise<MergedUpdatesResponse>;
    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse>;
    deleteGroup(chatId: string): Promise<DeleteGroupResponse>;
    editMessage(recipientId: string, message: Message, threadRootMessageIndex?: number): Promise<EditMessageResponse>;
    sendGroupICPTransfer(groupId: string, recipientId: string, sender: CreatedUser, message: Message, threadRootMessageIndex?: number): Promise<[SendMessageResponse, Message]>;
    sendMessage(recipientId: string, sender: CreatedUser, message: Message, replyingToChatId?: string, threadRootMessageIndex?: number): Promise<[SendMessageResponse, Message]>;
    blockUser(userId: string): Promise<BlockUserResponse>;
    unblockUser(userId: string): Promise<UnblockUserResponse>;
    leaveGroup(chatId: string): Promise<LeaveGroupResponse>;
    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse>;
    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse>;
    setAvatar(data: Uint8Array): Promise<BlobReference>;
    addReaction(otherUserId: string, messageId: bigint, reaction: string, username: string, threadRootMessageIndex?: number): Promise<AddRemoveReactionResponse>;
    removeReaction(otherUserId: string, messageId: bigint, reaction: string, threadRootMessageIndex?: number): Promise<AddRemoveReactionResponse>;
    deleteMessage(otherUserId: string, messageId: bigint, threadRootMessageIndex?: number): Promise<DeleteMessageResponse>;
    searchAllMessages(searchTerm: string, maxResults: number): Promise<SearchAllMessagesResponse>;
    searchDirectChat(userId: string, searchTerm: string, maxResults: number): Promise<SearchDirectChatResponse>;
    toggleMuteNotifications(chatId: string, muted: boolean): Promise<ToggleMuteNotificationResponse>;
    getRecommendedGroups(interrupt: ServiceRetryInterrupt): Promise<GroupChatSummary[]>;
    dismissRecommendation(chatId: string): Promise<void>;
    getBio(): Promise<string>;
    getPublicProfile(): Promise<PublicProfile>;
    setBio(bio: string): Promise<SetBioResponse>;
    withdrawCryptocurrency(domain: PendingCryptocurrencyWithdrawal): Promise<WithdrawCryptocurrencyResponse>;
    pinChat(chatId: string): Promise<PinChatResponse>;
    unpinChat(chatId: string): Promise<UnpinChatResponse>;
    archiveChat(chatId: string): Promise<ArchiveChatResponse>;
    unarchiveChat(chatId: string): Promise<ArchiveChatResponse>;
    initUserPrincipalMigration(newPrincipal: string): Promise<void>;
    migrateUserPrincipal(): Promise<MigrateUserPrincipalResponse>;
}
