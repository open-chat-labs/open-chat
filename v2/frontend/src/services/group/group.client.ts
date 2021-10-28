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
    EventWrapper,
    IndexRange,
    DeleteMessageResponse,
    EditMessageResponse,
    BlockUserResponse,
    MakeAdminResponse,
    RemoveAdminResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    UnblockUserResponse,
} from "../../domain/chat/chat";
import { CandidService } from "../candidService";
import {
    addParticipantsResponse,
    getEventsResponse,
    makeAdminResponse,
    sendMessageResponse,
    removeParticipantResponse,
    updateGroupResponse,
    toggleReactionResponse,
    deleteMessageResponse,
    editMessageResponse,
    blockUserResponse,
    removeAdminResponse,
    groupDetailsResponse,
    groupDetailsUpdatesResponse,
    unblockUserResponse,
} from "./mappers";
import type { IGroupClient } from "./group.client.interface";
import { CachingGroupClient } from "./group.caching.client";
import type { Database } from "../../utils/caching";
import { Principal } from "@dfinity/principal";
import { apiMessageContent, apiOptional } from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import {
    enoughVisibleMessages,
    mergeGroupChatDetails,
    nextIndex,
} from "../../domain/chat/chat.utils";

const MAX_RECURSION = 10;

export class GroupClient extends CandidService implements IGroupClient {
    private groupService: GroupService;

    constructor(identity: Identity, private chatId: string) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(idlFactory, chatId);
    }

    static create(chatId: string, identity: Identity, db?: Database): IGroupClient {
        return db && process.env.CLIENT_CACHING
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
                max_messages: 20,
                max_events: 200,
                mid_point: messageIndex,
            }),
            getEventsResponse
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        previouslyLoadedEvents: EventWrapper<GroupChatEvent>[] = [],
        iterations = 0
    ): Promise<EventsResponse<GroupChatEvent>> {
        const resp = await this.handleResponse(
            this.groupService.events({
                max_messages: 20,
                max_events: 50,
                ascending: ascending,
                start_index: startIndex,
            }),
            getEventsResponse
        );
        if (resp === "events_failed") {
            return resp;
        }

        // merge the retrieved events with the events accumulated from the previous iteration(s)
        // todo - we also need to merge affected events
        const merged = ascending
            ? [...previouslyLoadedEvents, ...resp.events]
            : [...resp.events, ...previouslyLoadedEvents];

        // check whether we have accumulated enough messages to display
        if (enoughVisibleMessages(ascending, eventIndexRange, merged)) {
            console.log("we got enough visible messages to display now");
            return { ...resp, events: merged };
        } else if (iterations < MAX_RECURSION) {
            // recurse and get the next chunk since we don't yet have enough events
            console.log("we don't have enough message, recursing", resp.events);
            return this.chatEvents(
                eventIndexRange,
                nextIndex(ascending, merged),
                ascending,
                merged,
                iterations + 1
            );
        } else {
            throw new Error(
                `Reached the maximum number of iterations of ${MAX_RECURSION} when trying to load events`
            );
        }
    }

    addParticipants(userIds: string[], allowBlocked: boolean): Promise<AddParticipantsResponse> {
        return this.handleResponse(
            this.groupService.add_participants({
                user_ids: userIds.map((u) => Principal.fromText(u)),
                allow_blocked_users: allowBlocked,
            }),
            addParticipantsResponse
        );
    }

    makeAdmin(userId: string): Promise<MakeAdminResponse> {
        return this.handleResponse(
            this.groupService.make_admin({
                user_id: Principal.fromText(userId),
            }),
            makeAdminResponse
        );
    }

    dismissAsAdmin(userId: string): Promise<RemoveAdminResponse> {
        return this.handleResponse(
            this.groupService.remove_admin({
                user_id: Principal.fromText(userId),
            }),
            removeAdminResponse
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
        return DataClient.create(this.identity, this.chatId)
            .uploadData(message.content)
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
    sendMessage(senderName: string, message: Message): Promise<SendMessageResponse> {
        return DataClient.create(this.identity, this.chatId)
            .uploadData(message.content)
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
                    }),
                    sendMessageResponse
                );
            });
    }

    updateGroup(name: string, desc: string, avatar?: Uint8Array): Promise<UpdateGroupResponse> {
        return this.handleResponse(
            this.groupService.update_group({
                name: name,
                description: desc,
                avatar: apiOptional(
                    (data) => ({
                        id: DataClient.newBlobId(),
                        mime_type: "image/jpg",
                        data: Array.from(data),
                    }),
                    avatar
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

        if (updatesResponse === "caller_not_in_group" || updatesResponse === "success_no_updates") {
            return previous;
        }

        return mergeGroupChatDetails(previous, updatesResponse);
    }
}
