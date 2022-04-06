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
} from "./mappers";
import type { IGroupClient } from "./group.client.interface";
import { CachingGroupClient } from "./group.caching.client";
import type { Database } from "../../utils/caching";
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

export class GroupClient extends CandidService implements IGroupClient {
    private groupService: GroupService;

    constructor(identity: Identity, private chatId: string) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(idlFactory, chatId);
    }

    static create(chatId: string, identity: Identity, db?: Database): IGroupClient {
        return db !== undefined && process.env.CLIENT_CACHING
            ? new CachingGroupClient(db, chatId, new GroupClient(identity, chatId))
            : new GroupClient(identity, chatId);
    }

    chatEventsByIndex(eventIndexes: number[]): Promise<EventsResponse<GroupChatEvent>> {
        return this.handleResponse(
            this.groupService.events_by_index({
                events: eventIndexes,
            }),
            getEventsResponse
        );
    }

    async chatEventsWindow(
        _eventIndexRange: IndexRange,
        messageIndex: number
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.handleResponse(
            this.groupService.events_window({
                max_messages: MAX_MESSAGES,
                max_events: MAX_EVENTS,
                mid_point: messageIndex,
            }),
            getEventsResponse
        );
    }

    chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<GroupChatEvent>> {
        const getChatEventsFunc = (index: number, asc: boolean) =>
            this.handleResponse(
                this.groupService.events({
                    max_messages: MAX_MESSAGES,
                    max_events: MAX_EVENTS,
                    ascending: asc,
                    start_index: index,
                }),
                getEventsResponse
            );

        return getChatEventsInLoop(getChatEventsFunc, eventIndexRange, startIndex, ascending);
    }

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

    removeParticipant(userId: string): Promise<RemoveParticipantResponse> {
        return this.handleResponse(
            this.groupService.remove_participant({
                user_id: Principal.fromText(userId),
            }),
            removeParticipantResponse
        );
    }

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

    toggleReaction(messageId: bigint, reaction: string): Promise<ToggleReactionResponse> {
        return this.handleResponse(
            this.groupService.toggle_reaction({
                message_id: messageId,
                reaction,
            }),
            toggleReactionResponse
        );
    }

    deleteMessage(messageId: bigint): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.groupService.delete_messages({
                message_ids: [messageId],
            }),
            deleteMessageResponse
        );
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.handleResponse(
            this.groupService.block_user({
                user_id: Principal.fromText(userId),
            }),
            blockUserResponse
        );
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.handleResponse(
            this.groupService.unblock_user({
                user_id: Principal.fromText(userId),
            }),
            unblockUserResponse
        );
    }

    getGroupDetails(): Promise<GroupChatDetailsResponse> {
        return this.handleResponse(this.groupService.selected_initial({}), groupDetailsResponse);
    }

    async getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails> {
        const updatesResponse = await this.handleResponse(
            this.groupService.selected_updates({
                updates_since: previous.latestEventIndex,
            }),
            groupDetailsUpdatesResponse
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

    deleteGroup(): Promise<DeleteGroupResponse> {
        return this.handleResponse(this.groupService.delete_group({}), deleteGroupResponse);
    }

    getPublicSummary(): Promise<GroupChatSummary | undefined> {
        return this.handleResponse(
            this.groupService.public_summary({}),
            publicSummaryResponse
        ).catch((_err) => {
            // whatever error we get, just assume that we cannot get hold of the group
            return undefined;
        });
    }

    getMessagesByMessageIndex(messageIndexes: Set<number>): Promise<EventsResponse<Message>> {
        return this.handleResponse(
            this.groupService.messages_by_message_index({
                messages: [...messageIndexes],
            }),
            getMessagesByMessageIndexResponse
        );
    }

    pinMessage(messageIndex: number): Promise<PinMessageResponse> {
        return this.handleResponse(
            this.groupService.pin_message({
                message_index: messageIndex,
            }),
            pinMessageResponse
        );
    }

    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse> {
        return this.handleResponse(
            this.groupService.unpin_message({
                message_index: messageIndex,
            }),
            unpinMessageResponse
        );
    }

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

    searchGroupChat(searchTerm: string, maxResults: number): Promise<SearchGroupChatResponse> {
        return this.handleResponse(
            this.groupService.search_messages({
                search_term: searchTerm,
                max_results: maxResults,
            }),
            searchGroupChatResponse
        );
    }
}
