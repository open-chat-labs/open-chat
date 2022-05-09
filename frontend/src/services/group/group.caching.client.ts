import type {
    AddParticipantsResponse,
    EventsResponse,
    GroupChatEvent,
    Message,
    SendMessageResponse,
    RemoveParticipantResponse,
    UpdateGroupResponse,
    ToggleReactionResponse,
    IndexRange,
    DeleteMessageResponse,
    EditMessageResponse,
    BlockUserResponse,
    ChangeRoleResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    UnblockUserResponse,
    DeleteGroupResponse,
    GroupChatSummary,
    MemberRole,
    PinMessageResponse,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    GroupPermissions,
    EventsSuccessResult,
    MakeGroupPrivateResponse,
    ChatEvent,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
} from "../../domain/chat/chat";
import type { User } from "../../domain/user/user";
import type { IGroupClient } from "./group.client.interface";
import type { IDBPDatabase } from "idb";
import {
    ChatSchema,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindow,
    getCachedGroupDetails,
    loadMessagesByMessageIndex,
    mergeSuccessResponses,
    setCachedEvents,
    setCachedGroupDetails,
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import type { SearchGroupChatResponse } from "../../domain/search/search";
import { profile } from "../common/profiling";
import { MAX_MISSING } from "../../domain/chat/chat.utils";
import { rollbar } from "../../utils/logging";

/**
 * This exists to decorate the group client so that we can provide a write through cache to
 * indexDB for holding chat events
 */
export class CachingGroupClient implements IGroupClient {
    constructor(
        private db: Promise<IDBPDatabase<ChatSchema>>,
        private chatId: string,
        private client: IGroupClient
    ) {}

    private setCachedEvents<T extends ChatEvent>(resp: EventsResponse<T>): EventsResponse<T> {
        setCachedEvents(this.db, this.chatId, resp).catch((err) =>
            rollbar.error("Error writing cached group events", err)
        );
        return resp;
    }

    private handleMissingEvents([cachedEvents, missing]: [
        EventsSuccessResult<GroupChatEvent>,
        Set<number>
    ]): Promise<EventsResponse<GroupChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.client
                .chatEventsByIndex([...missing])
                .then((resp) => this.setCachedEvents(resp))
                .then((resp) => {
                    if (resp !== "events_failed") {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    @profile("groupCachingClient")
    chatEventsByIndex(eventIndexes: number[]): Promise<EventsResponse<GroupChatEvent>> {
        return getCachedEventsByIndex<GroupChatEvent>(this.db, eventIndexes, this.chatId).then(
            (res) => this.handleMissingEvents(res)
        );
    }

    @profile("groupCachingClient")
    async chatEventsWindow(
        eventIndexRange: IndexRange,
        messageIndex: number
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindow<GroupChatEvent>(
            this.db,
            eventIndexRange,
            this.chatId,
            messageIndex
        );
        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss
            );
            return this.client
                .chatEventsWindow(eventIndexRange, messageIndex)
                .then((resp) => this.setCachedEvents(resp));
        } else {
            return this.handleMissingEvents([cachedEvents, missing]);
        }
    }

    @profile("groupCachingClient")
    async chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents<GroupChatEvent>(
            this.db,
            eventIndexRange,
            this.chatId,
            startIndex,
            ascending
        );

        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api");
            return this.client
                .chatEvents(eventIndexRange, startIndex, ascending)
                .then((resp) => this.setCachedEvents(resp));
        } else {
            return this.handleMissingEvents([cachedEvents, missing]);
        }
    }

    addParticipants(
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddParticipantsResponse> {
        return this.client.addParticipants(userIds, myUsername, allowBlocked);
    }

    sendMessage(
        senderName: string,
        mentioned: User[],
        message: Message
    ): Promise<SendMessageResponse> {
        return this.client
            .sendMessage(senderName, mentioned, message)
            .then(setCachedMessageFromSendResponse(this.db, this.chatId, message));
    }

    editMessage(message: Message): Promise<EditMessageResponse> {
        return this.client.editMessage(message);
    }

    changeRole(userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        return this.client.changeRole(userId, newRole);
    }

    removeParticipant(userId: string): Promise<RemoveParticipantResponse> {
        return this.client.removeParticipant(userId);
    }

    updateGroup(
        name: string,
        desc: string,
        avatar?: Uint8Array,
        permissions?: GroupPermissions
    ): Promise<UpdateGroupResponse> {
        return this.client.updateGroup(name, desc, avatar, permissions);
    }

    toggleReaction(messageId: bigint, reaction: string): Promise<ToggleReactionResponse> {
        return this.client.toggleReaction(messageId, reaction);
    }

    deleteMessage(messageId: bigint): Promise<DeleteMessageResponse> {
        return this.client.deleteMessage(messageId);
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.client.blockUser(userId);
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.client.unblockUser(userId);
    }

    @profile("groupCachingClient")
    async getGroupDetails(latestEventIndex: number): Promise<GroupChatDetailsResponse> {
        const fromCache = await getCachedGroupDetails(this.db, this.chatId);
        if (fromCache !== undefined) {
            if (fromCache.latestEventIndex >= latestEventIndex) {
                return fromCache;
            } else {
                return this.getGroupDetailsUpdates(fromCache);
            }
        }

        const response = await this.client.getGroupDetails(latestEventIndex);
        if (response !== "caller_not_in_group") {
            await setCachedGroupDetails(this.db, this.chatId, response);
        }
        return response;
    }

    @profile("groupCachingClient")
    async getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails> {
        const response = await this.client.getGroupDetailsUpdates(previous);
        if (response.latestEventIndex > previous.latestEventIndex) {
            await setCachedGroupDetails(this.db, this.chatId, response);
        }
        return response;
    }

    deleteGroup(): Promise<DeleteGroupResponse> {
        return this.client.deleteGroup();
    }

    makeGroupPrivate(): Promise<MakeGroupPrivateResponse> {
        return this.client.makeGroupPrivate();
    }

    getPublicSummary(): Promise<GroupChatSummary | undefined> {
        return this.client.getPublicSummary();
    }

    @profile("groupCachingClient")
    async getMessagesByMessageIndex(messageIndexes: Set<number>): Promise<EventsResponse<Message>> {
        const fromCache = await loadMessagesByMessageIndex(this.db, this.chatId, messageIndexes);
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await this.client
                .getMessagesByMessageIndex(fromCache.missing)
                .then((resp) => this.setCachedEvents(resp));

            return resp === "events_failed"
                ? "events_failed"
                : {
                      events: [...resp.events],
                      affectedEvents: resp.affectedEvents,
                  };
        }
        return {
            events: fromCache.messageEvents,
            affectedEvents: [],
        };
    }

    pinMessage(messageIndex: number): Promise<PinMessageResponse> {
        return this.client.pinMessage(messageIndex);
    }

    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse> {
        return this.client.unpinMessage(messageIndex);
    }

    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete"
    ): Promise<RegisterPollVoteResponse> {
        return this.client.registerPollVote(messageIdx, answerIdx, voteType);
    }

    searchGroupChat(searchTerm: string, maxResults: number): Promise<SearchGroupChatResponse> {
        return this.client.searchGroupChat(searchTerm, maxResults);
    }

    getInviteCode(): Promise<InviteCodeResponse> {
        return this.client.getInviteCode();
    }

    enableInviteCode(): Promise<EnableInviteCodeResponse> {
        return this.client.enableInviteCode();
    }

    disableInviteCode(): Promise<DisableInviteCodeResponse> {
        return this.client.disableInviteCode();
    }

    resetInviteCode(): Promise<ResetInviteCodeResponse> {
        return this.client.resetInviteCode();
    }
}
