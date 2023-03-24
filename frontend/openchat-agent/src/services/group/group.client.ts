import type { Identity } from "@dfinity/agent";
import { idlFactory, GroupService } from "./candid/idl";
import {
    AddMembersResponse,
    EventsResponse,
    GroupChatEvent,
    Message,
    SendMessageResponse,
    RemoveMemberResponse,
    UpdateGroupResponse,
    AddRemoveReactionResponse,
    IndexRange,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    EditMessageResponse,
    BlockUserResponse,
    ChangeRoleResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    UnblockUserResponse,
    GroupChatSummary,
    MemberRole,
    PinMessageResponse,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    GroupPermissions,
    MakeGroupPrivateResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    ThreadPreviewsResponse,
    RegisterProposalVoteResponse,
    GroupRules,
    textToCode,
    SearchGroupChatResponse,
    User,
    GroupCanisterSummaryResponse,
    GroupCanisterSummaryUpdatesResponse,
    DeletedGroupMessageResponse,
    EventWrapper,
    OptionUpdate,
    ClaimPrizeResponse,
} from "openchat-shared";
import { CandidService } from "../candidService";
import {
    apiRole,
    addMembersResponse,
    getEventsResponse,
    changeRoleResponse,
    sendMessageResponse,
    removeMemberResponse,
    updateGroupResponse,
    addRemoveReactionResponse,
    deleteMessageResponse,
    undeleteMessageResponse,
    editMessageResponse,
    blockUserResponse,
    groupDetailsResponse,
    groupDetailsUpdatesResponse,
    unblockUserResponse,
    getMessagesByMessageIndexResponse,
    pinMessageResponse,
    unpinMessageResponse,
    searchGroupChatResponse,
    makeGroupPrivateResponse,
    inviteCodeResponse,
    enableInviteCodeResponse,
    disableInviteCodeResponse,
    resetInviteCodeResponse,
    threadPreviewsResponse,
    registerPollVoteResponse,
    registerProposalVoteResponse,
    apiOptionalGroupPermissions,
    apiGroupRules,
    rulesResponse,
    summaryResponse,
    summaryUpdatesResponse,
    deletedMessageResponse,
    claimPrizeResponse,
} from "./mappers";
import type { IGroupClient } from "./group.client.interface";
import { CachingGroupClient } from "./group.caching.client";
import type { Database } from "../../utils/caching";
import { Principal } from "@dfinity/principal";
import { apiMessageContent, apiOptional, apiUser } from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import { identity, mergeGroupChatDetails } from "../../utils/chat";
import { MAX_EVENTS, MAX_MESSAGES } from "../../constants";
import { profile } from "../common/profiling";
import { publicSummaryResponse } from "../common/publicSummaryMapper";
import { apiOptionUpdate } from "../../utils/mapping";
import { generateUint64 } from "../../utils/rng";
import type { AgentConfig } from "../../config";

export class GroupClient extends CandidService implements IGroupClient {
    private groupService: GroupService;

    constructor(
        identity: Identity,
        private config: AgentConfig,
        private chatId: string,
        private inviteCode: string | undefined
    ) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(idlFactory, chatId, config);
    }

    static create(
        chatId: string,
        identity: Identity,
        config: AgentConfig,
        db: Database,
        inviteCode: string | undefined
    ): IGroupClient {
        return new CachingGroupClient(
            db,
            chatId,
            new GroupClient(identity, config, chatId, inviteCode),
            config.logger
        );
    }

    @profile("groupClient")
    summary(): Promise<GroupCanisterSummaryResponse> {
        return this.handleQueryResponse(() => this.groupService.summary({}), summaryResponse, {});
    }

    @profile("groupClient")
    summaryUpdates(updatesSince: bigint): Promise<GroupCanisterSummaryUpdatesResponse> {
        const args = { updates_since: updatesSince };

        return this.handleQueryResponse(
            () => this.groupService.summary_updates(args),
            summaryUpdatesResponse,
            args
        );
    }

    @profile("groupClient")
    chatEventsByIndex(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            events: new Uint32Array(eventIndexes),
            invite_code: apiOptional(textToCode, this.inviteCode),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        // FIXME - this always seems to through a ReplicaNotUpToDate error for threads.
        // Not sure if it is an existing issue as it doesn't break anything
        return this.handleQueryResponse(
            () => this.groupService.events_by_index(args),
            (resp) =>
                getEventsResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                ),
            args
        );
    }

    @profile("groupClient")
    async chatEventsWindow(
        _eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
            invite_code: apiOptional(textToCode, this.inviteCode),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.groupService.events_window(args),
            (resp) =>
                getEventsResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                ),
            args
        );
    }

    @profile("groupClient")
    chatEvents(
        _eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            ascending,
            start_index: startIndex,
            invite_code: apiOptional(textToCode, this.inviteCode),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.groupService.events(args),
            (resp) =>
                getEventsResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                ),
            args
        );
    }

    @profile("groupClient")
    addMembers(
        userIds: string[],
        myUsername: string,
        allowBlocked: boolean
    ): Promise<AddMembersResponse> {
        return this.handleResponse(
            this.groupService.add_participants({
                user_ids: userIds.map((u) => Principal.fromText(u)),
                added_by_name: myUsername,
                allow_blocked_users: allowBlocked,
                correlation_id: generateUint64(),
            }),
            addMembersResponse
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
                correlation_id: generateUint64(),
            }),
            changeRoleResponse
        );
    }

    @profile("groupClient")
    removeMember(userId: string): Promise<RemoveMemberResponse> {
        return this.handleResponse(
            this.groupService.remove_participant({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            removeMemberResponse
        );
    }

    @profile("groupClient")
    editMessage(message: Message, threadRootMessageIndex?: number): Promise<EditMessageResponse> {
        return DataClient.create(this.identity, this.config)
            .uploadData(message.content, [this.chatId])
            .then((content) => {
                return this.handleResponse(
                    this.groupService.edit_message({
                        thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                        content: apiMessageContent(content ?? message.content),
                        message_id: message.messageId,
                        correlation_id: generateUint64(),
                    }),
                    editMessageResponse
                );
            });
    }

    @profile("groupClient")
    claimPrize(messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.handleResponse(
            this.groupService.claim_prize({
                correlation_id: generateUint64(),
                message_id: messageId,
            }),
            claimPrizeResponse
        );
    }

    @profile("groupClient")
    sendMessage(
        senderName: string,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        const dataClient = DataClient.create(this.identity, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [this.chatId])
            : dataClient.uploadData(event.event.content, [this.chatId]);

        return uploadContentPromise.then((content) => {
            const newContent = content ?? event.event.content;
            const args = {
                content: apiMessageContent(newContent),
                message_id: event.event.messageId,
                sender_name: senderName,
                replies_to: apiOptional(
                    (replyContext) => ({
                        event_index: replyContext.eventIndex,
                    }),
                    event.event.repliesTo
                ),
                mentioned: mentioned.map(apiUser),
                forwarding: event.event.forwarded,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                correlation_id: generateUint64(),
            };
            return this.handleResponse(
                this.groupService.send_message(args),
                sendMessageResponse
            ).then((resp) => [resp, { ...event.event, content: newContent }]);
        });
    }

    @profile("groupClient")
    updateGroup(
        name?: string,
        description?: string,
        rules?: GroupRules,
        permissions?: Partial<GroupPermissions>,
        avatar?: Uint8Array,
        eventsTimeToLiveMs?: OptionUpdate<bigint>
    ): Promise<UpdateGroupResponse> {
        return this.handleResponse(
            this.groupService.update_group_v2({
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                avatar:
                    avatar === undefined
                        ? { NoChange: null }
                        : {
                              SetToSome: {
                                  id: DataClient.newBlobId(),
                                  mime_type: "image/jpg",
                                  data: avatar,
                              },
                          },
                permissions: apiOptional(apiOptionalGroupPermissions, permissions),
                rules: apiOptional(apiGroupRules, rules),
                events_ttl: apiOptionUpdate(identity, eventsTimeToLiveMs),
                correlation_id: generateUint64(),
            }),
            updateGroupResponse
        );
    }

    @profile("groupClient")
    addReaction(
        messageId: bigint,
        reaction: string,
        username: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.groupService.add_reaction({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                username,
                correlation_id: generateUint64(),
            }),
            addRemoveReactionResponse
        );
    }

    @profile("groupClient")
    removeReaction(
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.groupService.remove_reaction({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                correlation_id: generateUint64(),
            }),
            addRemoveReactionResponse
        );
    }

    @profile("groupClient")
    deleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.groupService.delete_messages({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
            }),
            deleteMessageResponse
        );
    }

    @profile("groupClient")
    undeleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<UndeleteMessageResponse> {
        return this.handleResponse(
            this.groupService.undelete_messages({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
            }),
            undeleteMessageResponse
        );
    }

    @profile("groupClient")
    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.handleResponse(
            this.groupService.block_user({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            blockUserResponse
        );
    }

    @profile("groupClient")
    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.handleResponse(
            this.groupService.unblock_user({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
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
    makeGroupPrivate(): Promise<MakeGroupPrivateResponse> {
        return this.handleResponse(
            this.groupService.make_private({
                correlation_id: generateUint64(),
            }),
            makeGroupPrivateResponse
        );
    }

    @profile("groupClient")
    getPublicSummary(): Promise<GroupChatSummary | undefined> {
        const args = { invite_code: apiOptional(textToCode, this.inviteCode) };
        return this.handleQueryResponse(
            () => this.groupService.public_summary(args),
            publicSummaryResponse,
            args
        ).catch((_err) => {
            // whatever error we get, just assume that we cannot get hold of the group
            return undefined;
        });
    }

    @profile("groupClient")
    getRules(): Promise<GroupRules | undefined> {
        const args = { invite_code: apiOptional(textToCode, this.inviteCode) };
        return this.handleQueryResponse(
            () => this.groupService.rules(args),
            rulesResponse,
            args
        ).catch((_err) => {
            // whatever error we get, just assume that we cannot get hold of the rules
            return undefined;
        });
    }

    @profile("groupClient")
    getMessagesByMessageIndex(
        messageIndexes: Set<number>,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<Message>> {
        const thread_root_message_index: [] = [];
        const invite_code: [] = [];
        const args = {
            thread_root_message_index,
            messages: new Uint32Array(messageIndexes),
            invite_code,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.groupService.messages_by_message_index(args),
            (resp) =>
                getMessagesByMessageIndexResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    undefined,
                    latestClientEventIndex
                ),
            args
        );
    }

    @profile("groupClient")
    getDeletedMessage(
        messageId: bigint,
        threadRootMessageIndex?: number
    ): Promise<DeletedGroupMessageResponse> {
        return this.handleResponse(
            this.groupService.deleted_message({
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            deletedMessageResponse
        );
    }

    @profile("groupClient")
    pinMessage(messageIndex: number): Promise<PinMessageResponse> {
        return this.handleResponse(
            this.groupService.pin_message_v2({
                message_index: messageIndex,
                correlation_id: generateUint64(),
            }),
            pinMessageResponse
        );
    }

    @profile("groupClient")
    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse> {
        return this.handleResponse(
            this.groupService.unpin_message({
                message_index: messageIndex,
                correlation_id: generateUint64(),
            }),
            unpinMessageResponse
        );
    }

    @profile("groupClient")
    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse> {
        return this.handleResponse(
            this.groupService.register_poll_vote({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                poll_option: answerIdx,
                operation: voteType === "register" ? { RegisterVote: null } : { DeleteVote: null },
                message_index: messageIdx,
                correlation_id: generateUint64(),
            }),
            registerPollVoteResponse
        );
    }

    @profile("groupClient")
    searchGroupChat(
        searchTerm: string,
        userIds: string[],
        maxResults: number
    ): Promise<SearchGroupChatResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
            users: apiOptional(
                identity,
                userIds.map((u) => Principal.fromText(u))
            ),
        };
        return this.handleQueryResponse(
            () => this.groupService.search_messages(args),
            searchGroupChatResponse,
            args
        );
    }

    @profile("groupClient")
    getInviteCode(): Promise<InviteCodeResponse> {
        return this.handleQueryResponse(
            () => this.groupService.invite_code({}),
            inviteCodeResponse
        );
    }

    @profile("groupClient")
    enableInviteCode(): Promise<EnableInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.enable_invite_code({
                correlation_id: generateUint64(),
            }),
            enableInviteCodeResponse
        );
    }

    @profile("groupClient")
    disableInviteCode(): Promise<DisableInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.disable_invite_code({
                correlation_id: generateUint64(),
            }),
            disableInviteCodeResponse
        );
    }

    @profile("groupClient")
    resetInviteCode(): Promise<ResetInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.reset_invite_code({
                correlation_id: generateUint64(),
            }),
            resetInviteCodeResponse
        );
    }

    @profile("groupClient")
    threadPreviews(
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined
    ): Promise<ThreadPreviewsResponse> {
        return this.handleQueryResponse(
            () =>
                this.groupService.thread_previews({
                    threads: new Uint32Array(threadRootMessageIndexes),
                    latest_client_thread_update: apiOptional(identity, latestClientThreadUpdate),
                }),
            (resp) => threadPreviewsResponse(resp, this.chatId, latestClientThreadUpdate)
        );
    }

    @profile("groupClient")
    registerProposalVote(
        messageIdx: number,
        adopt: boolean
    ): Promise<RegisterProposalVoteResponse> {
        return this.handleResponse(
            this.groupService.register_proposal_vote({
                adopt,
                message_index: messageIdx,
            }),
            registerProposalVoteResponse
        );
    }

    @profile("groupClient")
    localUserIndex(): Promise<string> {
        return this.handleQueryResponse(
            () => this.groupService.local_user_index({}),
            (resp) => resp.Success.toString()
        );
    }
}
