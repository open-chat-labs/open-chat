import type { Identity } from "@dfinity/agent";
import { idlFactory, GroupService } from "./candid/idl";
import type {
    AddMembersResponse,
    EventsResponse,
    GroupChatEvent,
    Message,
    SendMessageResponse,
    RemoveMemberResponse,
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
    UpdatePermissionsResponse,
    ThreadPreviewsResponse,
    RegisterProposalVoteResponse,
    GroupRules,
} from "../../domain/chat/chat";
import type { User } from "../../domain/user/user";
import { CandidService, ServiceRetryInterrupt } from "../candidService";
import {
    apiRole,
    addMembersResponse,
    getEventsResponse,
    changeRoleResponse,
    sendMessageResponse,
    removeMemberResponse,
    updateGroupResponse,
    toggleReactionResponse,
    deleteMessageResponse,
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
    updatePermissionsResponse,
    threadPreviewsResponse,
    registerPollVoteResponse,
    registerProposalVoteResponse,
} from "./mappers";
import type { IGroupClient } from "./group.client.interface";
import { CachingGroupClient } from "./group.caching.client";
import { cachingLocallyDisabled, Database } from "../../utils/caching";
import { Principal } from "@dfinity/principal";
import {
    apiMessageContent,
    apiOptional,
    apiUpdatePermissions,
    apiUser,
} from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import { identity, mergeGroupChatDetails } from "../../domain/chat/chat.utils";
import { MAX_EVENTS } from "../../domain/chat/chat.utils.shared";
import type { SearchGroupChatResponse } from "../../domain/search/search";
import { getChatEventsInLoop } from "../common/chatEvents";
import { profile } from "../common/profiling";
import { textToCode } from "../../domain/inviteCodes";
import { publicSummaryResponse } from "../common/publicSummaryMapper";

export class GroupClient extends CandidService implements IGroupClient {
    private groupService: GroupService;

    constructor(
        identity: Identity,
        private chatId: string,
        private inviteCode: string | undefined
    ) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(idlFactory, chatId);
    }

    static create(
        chatId: string,
        identity: Identity,
        db: Database | undefined,
        inviteCode: string | undefined
    ): IGroupClient {
        return db !== undefined && process.env.CLIENT_CACHING && !cachingLocallyDisabled()
            ? new CachingGroupClient(db, chatId, new GroupClient(identity, chatId, inviteCode))
            : new GroupClient(identity, chatId, inviteCode);
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
        return this.handleQueryResponse(
            () => this.groupService.events_by_index(args),
            (resp) =>
                getEventsResponse(
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
        latestClientEventIndex: number | undefined,
        interrupt?: ServiceRetryInterrupt
    ): Promise<EventsResponse<GroupChatEvent>> {
        const thread_root_message_index: [] = [];
        const args = {
            thread_root_message_index,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
            invite_code: apiOptional(textToCode, this.inviteCode),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.groupService.events_window(args),
            (resp) => getEventsResponse(resp, this.chatId, undefined, latestClientEventIndex),
            args,
            interrupt
        );
    }

    @profile("groupClient")
    chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined,
        interrupt?: ServiceRetryInterrupt
    ): Promise<EventsResponse<GroupChatEvent>> {
        const getChatEventsFunc = (index: number, asc: boolean) => {
            const args = {
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                max_events: MAX_EVENTS,
                ascending: asc,
                start_index: index,
                invite_code: apiOptional(textToCode, this.inviteCode),
                latest_client_event_index: apiOptional(identity, latestClientEventIndex),
            };
            return this.handleQueryResponse(
                () => this.groupService.events(args),
                (resp) =>
                    getEventsResponse(
                        resp,
                        this.chatId,
                        threadRootMessageIndex,
                        latestClientEventIndex
                    ),
                args,
                interrupt
            );
        };

        return getChatEventsInLoop(getChatEventsFunc, eventIndexRange, startIndex, ascending);
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
            }),
            changeRoleResponse
        );
    }

    @profile("groupClient")
    removeMember(userId: string): Promise<RemoveMemberResponse> {
        return this.handleResponse(
            this.groupService.remove_participant({
                user_id: Principal.fromText(userId),
            }),
            removeMemberResponse
        );
    }

    @profile("groupClient")
    editMessage(message: Message, threadRootMessageIndex?: number): Promise<EditMessageResponse> {
        return DataClient.create(this.identity)
            .uploadData(message.content, [this.chatId])
            .then((content) => {
                return this.handleResponse(
                    this.groupService.edit_message({
                        thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                        content: apiMessageContent(content ?? message.content),
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
        message: Message,
        threadRootMessageIndex?: number
    ): Promise<[SendMessageResponse, Message]> {
        const dataClient = DataClient.create(this.identity);
        const uploadContentPromise = message.forwarded
            ? dataClient.forwardData(message.content, [this.chatId])
            : dataClient.uploadData(message.content, [this.chatId]);

        return uploadContentPromise.then((content) => {
            const newContent = content ?? message.content;
            const args = {
                content: apiMessageContent(newContent),
                message_id: message.messageId,
                sender_name: senderName,
                replies_to: apiOptional(
                    (replyContext) => ({
                        event_index: replyContext.eventIndex,
                    }),
                    message.repliesTo
                ),
                mentioned: mentioned.map(apiUser),
                forwarding: message.forwarded,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            };
            return this.handleResponse(
                this.groupService.send_message(args),
                sendMessageResponse
            ).then((resp) => [resp, { ...message, content: newContent }]);
        });
    }

    @profile("groupClient")
    updateGroup(
        name: string,
        desc: string,
        rules: GroupRules,
        avatar?: Uint8Array
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
                                  data: avatar,
                              },
                          },
                permissions: [],
                rules,
            }),
            updateGroupResponse
        );
    }

    @profile("groupClient")
    updatePermissions(permissions: Partial<GroupPermissions>): Promise<UpdatePermissionsResponse> {
        return this.handleResponse(
            this.groupService.update_permissions(apiUpdatePermissions(permissions)),
            updatePermissionsResponse
        );
    }

    @profile("groupClient")
    toggleReaction(
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number
    ): Promise<ToggleReactionResponse> {
        return this.handleResponse(
            this.groupService.toggle_reaction({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
            }),
            toggleReactionResponse
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
    makeGroupPrivate(): Promise<MakeGroupPrivateResponse> {
        return this.handleResponse(this.groupService.make_private({}), makeGroupPrivateResponse);
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
                    resp,
                    this.chatId,
                    undefined,
                    latestClientEventIndex
                ),
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
        voteType: "register" | "delete",
        threadRootMessageIndex?: number
    ): Promise<RegisterPollVoteResponse> {
        return this.handleResponse(
            this.groupService.register_poll_vote({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
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

    @profile("groupClient")
    getInviteCode(): Promise<InviteCodeResponse> {
        return this.handleQueryResponse(
            () => this.groupService.invite_code({}),
            inviteCodeResponse
        );
    }

    @profile("groupClient")
    enableInviteCode(): Promise<EnableInviteCodeResponse> {
        return this.handleQueryResponse(
            () => this.groupService.enable_invite_code({}),
            enableInviteCodeResponse
        );
    }

    @profile("groupClient")
    disableInviteCode(): Promise<DisableInviteCodeResponse> {
        return this.handleQueryResponse(
            () => this.groupService.disable_invite_code({}),
            disableInviteCodeResponse
        );
    }

    @profile("groupClient")
    resetInviteCode(): Promise<ResetInviteCodeResponse> {
        return this.handleQueryResponse(
            () => this.groupService.reset_invite_code({}),
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
}
