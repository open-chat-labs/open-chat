import type { Identity } from "@dfinity/agent";
import { idlFactory, GroupService } from "./candid/idl";
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
    MakeGroupPrivateResponse,
} from "../../domain/chat/chat";
import type { User } from "../../domain/user/user";
import { CandidService } from "../candidService";
import {
    apiRole,
    addParticipantsResponse,
    getEventsResponse,
    changeRoleResponse,
    sendMessageResponse,
    removeParticipantResponse,
    updateGroupResponse,
    toggleReactionResponse,
    deleteMessageResponse,
    editMessageResponse,
    blockUserResponse,
    groupDetailsResponse,
    groupDetailsUpdatesResponse,
    unblockUserResponse,
    deleteGroupResponse,
    getMessagesByMessageIndexResponse,
    pinMessageResponse,
    unpinMessageResponse,
    searchGroupChatResponse,
    makeGroupPrivateResponse,
} from "./mappers";
import type { IGroupClient } from "./group.client.interface";
import { CachingGroupClient } from "./group.caching.client";
import { cachingLocallyDisabled, Database } from "../../utils/caching";
import { Principal } from "@dfinity/principal";
import {
    apiGroupPermissions,
    apiMessageContent,
    apiOptional,
    apiUser,
    publicSummaryResponse,
    registerPollVoteResponse,
} from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import { MAX_EVENTS, MAX_MESSAGES, mergeGroupChatDetails } from "../../domain/chat/chat.utils";
import type { SearchGroupChatResponse } from "../../domain/search/search";
import { getChatEventsInLoop } from "../common/chatEvents";
import { profile } from "../common/profiling";

export class GroupClient extends CandidService implements IGroupClient {
    private groupService: GroupService;

    constructor(identity: Identity, private chatId: string) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(idlFactory, chatId);
    }

    static create(chatId: string, identity: Identity, db?: Database): IGroupClient {
        return db !== undefined && process.env.CLIENT_CACHING && !cachingLocallyDisabled()
            ? new CachingGroupClient(db, chatId, new GroupClient(identity, chatId))
            : new GroupClient(identity, chatId);
    }

    @profile("groupClient")
    chatEventsByIndex(eventIndexes: number[]): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            events: eventIndexes,
        };
        return this.handleQueryResponse(
            () => this.groupService.events_by_index(args),
            getEventsResponse,
            args
        );
    }

    @profile("groupClient")
    async chatEventsWindow(
        _eventIndexRange: IndexRange,
        messageIndex: number
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
        };
        return this.handleQueryResponse(
            () => this.groupService.events_window(args),
            getEventsResponse,
            args
        );
    }

    @profile("groupClient")
    chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<GroupChatEvent>> {
        const getChatEventsFunc = (index: number, asc: boolean) => {
            const args = {
                max_messages: MAX_MESSAGES,
                max_events: MAX_EVENTS,
                ascending: asc,
                start_index: index,
            };
            return this.handleResponse(this.groupService.events(args), getEventsResponse, args);
        };

        return getChatEventsInLoop(getChatEventsFunc, eventIndexRange, startIndex, ascending);
    }

    @profile("groupClient")
    addParticipants(
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddParticipantsResponse> {
        return this.handleResponse(
            this.groupService.add_participants({
                user_ids: userIds.map((u) => Principal.fromText(u)),
                added_by_name: myUsername,
                allow_blocked_users: allowBlocked,
            }),
            addParticipantsResponse
        );
    }

    @profile("groupClient")
    changeRole(userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        const new_role = apiRole(newRole);
        if (new_role === undefined) {
            throw new Error(`Cannot change user's role to: ${newRole}`);
        }
        return this.handleResponse(
            this.groupService.change_role({
                user_id: Principal.fromText(userId),
                new_role,
            }),
            changeRoleResponse
        );
    }

    @profile("groupClient")
    removeParticipant(userId: string): Promise<RemoveParticipantResponse> {
        return this.handleResponse(
            this.groupService.remove_participant({
                user_id: Principal.fromText(userId),
            }),
            removeParticipantResponse
        );
    }

    @profile("groupClient")
    editMessage(message: Message): Promise<EditMessageResponse> {
        return DataClient.create(this.identity)
            .uploadData(message.content, [this.chatId])
            .then(() => {
                return this.handleResponse(
                    this.groupService.edit_message({
                        content: apiMessageContent(message.content),
                        message_id: message.messageId,
                    }),
                    editMessageResponse
                );
            });
    }

    @profile("groupClient")
    sendMessage(
        senderName: string,
        mentioned: User[],
        message: Message
    ): Promise<SendMessageResponse> {
        return DataClient.create(this.identity)
            .uploadData(message.content, [this.chatId])
            .then(() => {
                return this.handleResponse(
                    this.groupService.send_message({
                        content: apiMessageContent(message.content),
                        message_id: message.messageId,
                        sender_name: senderName,
                        replies_to: apiOptional(
                            (replyContext) => ({
                                event_index: replyContext.eventIndex,
                            }),
                            message.repliesTo
                        ),
                        mentioned: mentioned.map(apiUser),
                    }),
                    sendMessageResponse
                );
            });
    }

    @profile("groupClient")
    updateGroup(
        name: string,
        desc: string,
        avatar?: Uint8Array,
        permissions?: GroupPermissions
    ): Promise<UpdateGroupResponse> {
        return this.handleResponse(
            this.groupService.update_group({
                name: name,
                description: desc,
                avatar:
                    avatar === undefined
                        ? { NoChange: null }
                        : {
                              SetToSome: {
                                  id: DataClient.newBlobId(),
                                  mime_type: "image/jpg",
                                  data: Array.from(avatar),
                              },
                          },
                permissions: apiOptional(
                    (permissions) => apiGroupPermissions(permissions),
                    permissions
                ),
            }),
            updateGroupResponse
        );
    }

    @profile("groupClient")
    toggleReaction(messageId: bigint, reaction: string): Promise<ToggleReactionResponse> {
        return this.handleResponse(
            this.groupService.toggle_reaction({
                message_id: messageId,
                reaction,
            }),
            toggleReactionResponse
        );
    }

    @profile("groupClient")
    deleteMessage(messageId: bigint): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.groupService.delete_messages({
                message_ids: [messageId],
            }),
            deleteMessageResponse
        );
    }

    @profile("groupClient")
    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.handleResponse(
            this.groupService.block_user({
                user_id: Principal.fromText(userId),
            }),
            blockUserResponse
        );
    }

    @profile("groupClient")
    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.handleResponse(
            this.groupService.unblock_user({
                user_id: Principal.fromText(userId),
            }),
            unblockUserResponse
        );
    }

    @profile("groupClient")
    getGroupDetails(_latestEventIndex: number): Promise<GroupChatDetailsResponse> {
        return this.handleQueryResponse(
            () => this.groupService.selected_initial({}),
            groupDetailsResponse
        );
    }

    @profile("groupClient")
    async getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails> {
        const args = {
            updates_since: previous.latestEventIndex,
        };
        const updatesResponse = await this.handleQueryResponse(
            () => this.groupService.selected_updates(args),
            groupDetailsUpdatesResponse,
            args
        );

        if (updatesResponse === "caller_not_in_group") {
            return previous;
        }

        if (updatesResponse.kind === "success_no_updates") {
            return {
                ...previous,
                latestEventIndex: updatesResponse.latestEventIndex,
            };
        }

        return mergeGroupChatDetails(previous, updatesResponse);
    }

    @profile("groupClient")
    deleteGroup(): Promise<DeleteGroupResponse> {
        return this.handleResponse(this.groupService.delete_group({}), deleteGroupResponse);
    }

    @profile("groupClient")
    makeGroupPrivate(): Promise<MakeGroupPrivateResponse> {
        return this.handleResponse(this.groupService.make_private({}), makeGroupPrivateResponse);
    }

    @profile("groupClient")
    getPublicSummary(): Promise<GroupChatSummary | undefined> {
        return this.handleQueryResponse(
            () => this.groupService.public_summary({}),
            publicSummaryResponse
        ).catch((_err) => {
            // whatever error we get, just assume that we cannot get hold of the group
            return undefined;
        });
    }

    @profile("groupClient")
    getMessagesByMessageIndex(messageIndexes: Set<number>): Promise<EventsResponse<Message>> {
        const args = {
            messages: [...messageIndexes],
        };
        return this.handleQueryResponse(
            () => this.groupService.messages_by_message_index(args),
            getMessagesByMessageIndexResponse,
            args
        );
    }

    @profile("groupClient")
    pinMessage(messageIndex: number): Promise<PinMessageResponse> {
        return this.handleResponse(
            this.groupService.pin_message({
                message_index: messageIndex,
            }),
            pinMessageResponse
        );
    }

    @profile("groupClient")
    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse> {
        return this.handleResponse(
            this.groupService.unpin_message({
                message_index: messageIndex,
            }),
            unpinMessageResponse
        );
    }

    @profile("groupClient")
    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete"
    ): Promise<RegisterPollVoteResponse> {
        return this.handleResponse(
            this.groupService.register_poll_vote({
                poll_option: answerIdx,
                operation: voteType === "register" ? { RegisterVote: null } : { DeleteVote: null },
                message_index: messageIdx,
            }),
            registerPollVoteResponse
        );
    }

    @profile("groupClient")
    searchGroupChat(searchTerm: string, maxResults: number): Promise<SearchGroupChatResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(
            () => this.groupService.search_messages(args),
            searchGroupChatResponse,
            args
        );
    }
}
