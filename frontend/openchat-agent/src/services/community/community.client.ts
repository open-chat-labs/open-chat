/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import { idlFactory, CommunityService } from "./candid/idl";
import { CandidService } from "../candidService";
import { identity } from "../../utils/mapping";
import type { AgentConfig } from "../../config";
import {
    addMembersToChannelResponse,
    addReactionResponse,
    blockUserResponse,
    changeChannelRoleResponse,
    changeRoleResponse,
    createChannelResponse,
    declineInvitationResponse,
    deleteChannelResponse,
    deleteMessagesResponse,
    deleteMessageResponse,
    disableInviteCodeResponse,
    editMessageResponse,
    enableInviteCodeResponse,
    inviteCodeResponse,
    joinChannelResponse,
    leaveChannelResponse,
    localUserIndexResponse,
    makeChannelPrivateResponse,
    makeCommunityPrivateResponse,
    messagesByMessageIndexResponse,
    pinMessageResponse,
    removeMemberResponse,
    removeMemberFromChannelResponse,
    removeReactionResponse,
    rulesResponse,
    searchChannelResponse,
    selectedChannelInitialResponse,
    selectedChannelUpdatesResponse,
    sendMessageResponse,
    summaryResponse,
    summaryUpdatesResponse,
    toggleMuteChannelNotificationsResponse,
    toggleMuteNotificationsResponse,
    unblockUserResponse,
    undeleteMessagesResponse,
    updateChannelResponse,
    updateCommunityResponse,
    apiMemberRole,
    apiCommunityRole,
    apiOptionalCommunityPermissions,
} from "./mappers";
import { Principal } from "@dfinity/principal";
import {
    apiGroupPermissions,
    apiMaybeAccessGate,
    apiOptional,
    apiMessageContent,
    apiUser,
    apiAccessGate,
} from "../common/chatMappers";
import type {
    AccessGate,
    AccessRules,
    AddMembersToChannelResponse,
    AddReactionResponse,
    BlockCommunityUserResponse,
    CandidateChannel,
    ChangeChannelRoleResponse,
    ChangeCommunityRoleResponse,
    CommunityInviteCodeResponse,
    CommunityPermissions,
    CommunityRulesResponse,
    CreateChannelResponse,
    DeclineChannelInvitationResponse,
    DeleteChannelMessageResponse,
    DeleteChannelMessagesResponse,
    DeleteChannelResponse,
    DisableCommunityInviteCodeResponse,
    EditChannelMessageResponse,
    EnableCommunityInviteCodeResponse,
    EventWrapper,
    EventsResponse,
    GroupChatEvent,
    GroupPermissions,
    JoinChannelResponse,
    LeaveChannelResponse,
    MakeChannelPrivateResponse,
    MakeCommunityPrivateResponse,
    MemberRole,
    Message,
    PinChannelMessageResponse,
    RemoveChannelMemberResponse,
    RemoveChannelReactionResponse,
    RemoveCommunityMemberResponse,
    SearchChannelResponse,
    SelectedChannelInitialResponse,
    SelectedChannelUpdatesResponse,
    SendChannelMessageResponse,
    ToggleMuteChannelNotificationsResponse,
    ToggleMuteCommunityNotificationsResponse,
    UnblockCommunityUserResponse,
    UndeleteChannelMessagesResponse,
    UpdateChannelResponse,
    UpdateCommunityResponse,
    User,
} from "openchat-shared";
import { apiGroupRules, apiOptionalGroupPermissions } from "../group/mappers";
import { DataClient } from "../data/data.client";
import { MAX_EVENTS, MAX_MESSAGES } from "../../constants";
import { getEventsResponse } from "../group/mappers";

export class CommunityClient extends CandidService {
    private service: CommunityService;

    private constructor(communityId: string, identity: Identity, private config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<CommunityService>(idlFactory, communityId, config);
    }

    static create(communityId: string, identity: Identity, config: AgentConfig): CommunityClient {
        return new CommunityClient(communityId, identity, config);
    }

    addMembersToChannel(
        channelId: string,
        userIds: string[],
        username: string
    ): Promise<AddMembersToChannelResponse> {
        return this.handleResponse(
            this.service.add_members_to_channel({
                channel_id: BigInt(channelId),
                user_ids: userIds.map((u) => Principal.fromText(u)),
                added_by_name: username,
            }),
            addMembersToChannelResponse
        );
    }

    addReaction(
        channelId: string,
        username: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex: number | undefined
    ): Promise<AddReactionResponse> {
        return this.handleResponse(
            this.service.add_reaction({
                channel_id: BigInt(channelId),
                username,
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                reaction,
            }),
            addReactionResponse
        );
    }

    blockUser(userId: string): Promise<BlockCommunityUserResponse> {
        return this.handleResponse(
            this.service.block_user({
                user_id: Principal.fromText(userId),
            }),
            blockUserResponse
        );
    }

    changeChannelRole(
        channelId: string,
        userId: string,
        newRole: MemberRole
    ): Promise<ChangeChannelRoleResponse> {
        return this.handleResponse(
            this.service.change_channel_role({
                channel_id: BigInt(channelId),
                user_id: Principal.fromText(userId),
                new_role: apiMemberRole(newRole),
            }),
            changeChannelRoleResponse
        );
    }

    changeRole(userId: string, newRole: MemberRole): Promise<ChangeCommunityRoleResponse> {
        return this.handleResponse(
            this.service.change_role({
                user_id: Principal.fromText(userId),
                new_role: apiCommunityRole(newRole),
            }),
            changeRoleResponse
        );
    }

    createChannel(channel: CandidateChannel): Promise<CreateChannelResponse> {
        return this.handleResponse(
            this.service.create_channel({
                is_public: channel.public,
                name: channel.name,
                subtype: [],
                events_ttl: [], // TODO - not sure what this is for
                description: channel.description,
                history_visible_to_new_joiners: channel.historyVisible,
                avatar: apiOptional((data) => {
                    return {
                        id: DataClient.newBlobId(),
                        data,
                        mime_type: "image/jpg",
                    };
                }, channel.avatar?.blobData),
                permissions: [apiGroupPermissions(channel.permissions)],
                rules: apiGroupRules(channel.rules),
                gate: apiMaybeAccessGate(channel.gate),
            }),
            createChannelResponse
        );
    }

    declineInvitation(channelId: string): Promise<DeclineChannelInvitationResponse> {
        return this.handleResponse(
            this.service.decline_invitation({
                channel_id: [BigInt(channelId)],
            }),
            declineInvitationResponse
        );
    }

    deleteChannel(channelId: string): Promise<DeleteChannelResponse> {
        return this.handleResponse(
            this.service.delete_channel({
                channel_id: BigInt(channelId),
            }),
            deleteChannelResponse
        );
    }

    deleteMessages(
        channelId: string,
        messageIds: bigint[],
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined
    ): Promise<DeleteChannelMessagesResponse> {
        return this.handleResponse(
            this.service.delete_messages({
                channel_id: BigInt(channelId),
                message_ids: messageIds,
                as_platform_moderator: apiOptional(identity, asPlatformModerator),
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            deleteMessagesResponse
        );
    }

    deleteMessage(
        channelId: string,
        messageId: bigint,
        sender: string,
        threadRootMessageIndex: number | undefined
    ): Promise<DeleteChannelMessageResponse> {
        return this.handleResponse(
            this.service.deleted_message({
                channel_id: BigInt(channelId),
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            (res) => deleteMessageResponse(res, sender)
        );
    }

    disableInviteCode(): Promise<DisableCommunityInviteCodeResponse> {
        return this.handleResponse(this.service.disable_invite_code({}), disableInviteCodeResponse);
    }

    editMessage(
        channelId: string,
        message: Message,
        threadRootMessageIndex: number | undefined
    ): Promise<EditChannelMessageResponse> {
        return DataClient.create(this.identity, this.config)
            .uploadData(message.content, [channelId])
            .then((content) => {
                return this.handleResponse(
                    this.service.edit_message({
                        channel_id: BigInt(channelId),
                        thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                        content: apiMessageContent(content ?? message.content),
                        message_id: message.messageId,
                    }),
                    editMessageResponse
                );
            });
    }

    enableInviteCode(): Promise<EnableCommunityInviteCodeResponse> {
        return this.handleResponse(this.service.enable_invite_code({}), enableInviteCodeResponse);
    }

    events(
        channelId: string,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            channel_id: BigInt(channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            start_index: startIndex,
            ascending: ascending,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.service.events(args),
            (res) => {
                return getEventsResponse(
                    this.principal,
                    res,
                    channelId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                );
            }
        );
    }

    eventsByIndex(
        channelId: string,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            channel_id: BigInt(channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            events: new Uint32Array(eventIndexes),
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.service.events_by_index(args),
            (res) => {
                return getEventsResponse(
                    this.principal,
                    res,
                    channelId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                );
            }
        );
    }

    eventsWindow(
        channelId: string,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestClientEventIndex: number | undefined
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            channel_id: BigInt(channelId),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
        };
        return this.handleQueryResponse(
            () => this.service.events_window(args),
            (res) => {
                return getEventsResponse(
                    this.principal,
                    res,
                    channelId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                );
            }
        );
    }

    inviteCode(): Promise<CommunityInviteCodeResponse> {
        return this.handleResponse(this.service.invite_code({}), inviteCodeResponse);
    }

    joinChannel(channelId: string): Promise<JoinChannelResponse> {
        return this.handleResponse(
            this.service.join_channel({
                channel_id: BigInt(channelId),
            }),
            joinChannelResponse
        );
    }

    leaveChannel(channelId: string): Promise<LeaveChannelResponse> {
        return this.handleResponse(
            this.service.leave_channel({
                channel_id: BigInt(channelId),
            }),
            leaveChannelResponse
        );
    }

    localUserIndex(): Promise<unknown> {
        return this.handleResponse(this.service.local_user_index({}), localUserIndexResponse);
    }

    makeChannelPrivate(channelId: string): Promise<MakeChannelPrivateResponse> {
        return this.handleResponse(
            this.service.make_channel_private({
                channel_id: BigInt(channelId),
            }),
            makeChannelPrivateResponse
        );
    }

    makePrivate(): Promise<MakeCommunityPrivateResponse> {
        return this.handleResponse(this.service.make_private({}), makeCommunityPrivateResponse);
    }

    messagesByMessageIndex(
        channelId: string,
        messageIndexes: number[],
        latestClientEventIndex: number | undefined,
        threadRootMessageIndex: number | undefined
    ): Promise<EventsResponse<Message>> {
        const args = {
            channel_id: BigInt(channelId),
            messages: messageIndexes,
            latest_client_event_index: apiOptional(identity, latestClientEventIndex),
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
        };
        return this.handleQueryResponse(
            () => this.service.messages_by_message_index(args),
            (res) =>
                messagesByMessageIndexResponse(
                    this.principal,
                    res,
                    channelId,
                    threadRootMessageIndex,
                    latestClientEventIndex
                )
        );
    }

    pinMessage(channelId: string, messageIndex: number): Promise<PinChannelMessageResponse> {
        return this.handleResponse(
            this.service.pin_message({
                channel_id: BigInt(channelId),
                message_index: messageIndex,
            }),
            pinMessageResponse
        );
    }

    removeMember(userId: string): Promise<RemoveCommunityMemberResponse> {
        return this.handleResponse(
            this.service.remove_member({
                user_id: Principal.fromText(userId),
            }),
            removeMemberResponse
        );
    }

    removeMemberFromChannel(
        channelId: string,
        userId: string
    ): Promise<RemoveChannelMemberResponse> {
        return this.handleResponse(
            this.service.remove_member_from_channel({
                channel_id: BigInt(channelId),
                user_id: Principal.fromText(userId),
            }),
            removeMemberFromChannelResponse
        );
    }

    removeReaction(
        channelId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex: number | undefined
    ): Promise<RemoveChannelReactionResponse> {
        return this.handleResponse(
            this.service.remove_reaction({
                channel_id: BigInt(channelId),
                message_id: messageId,
                reaction,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            removeReactionResponse
        );
    }

    resetInviteCode(): Promise<EnableCommunityInviteCodeResponse> {
        return this.handleResponse(this.service.reset_invite_code({}), enableInviteCodeResponse);
    }

    rules(inviteCode: string | undefined): Promise<CommunityRulesResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.rules({
                    invite_code: apiOptional((c) => BigInt(c), inviteCode),
                }),
            rulesResponse
        );
    }

    searchChannel(
        channelId: string,
        maxResults: number,
        users: string[],
        searchTerm: string
    ): Promise<SearchChannelResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.search_channel({
                    channel_id: BigInt(channelId),
                    max_results: maxResults,
                    users: users.length > 0 ? [users.map((u) => Principal.fromText(u))] : [],
                    search_term: searchTerm,
                }),
            searchChannelResponse
        );
    }

    selectedChannelInitial(channelId: string): Promise<SelectedChannelInitialResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.selected_channel_initial({
                    channel_id: BigInt(channelId),
                }),
            selectedChannelInitialResponse
        );
    }

    selectedChannelUpdates(
        channelId: string,
        updatesSince: bigint
    ): Promise<SelectedChannelUpdatesResponse> {
        return this.handleQueryResponse(
            () =>
                this.service.selected_channel_updates({
                    channel_id: BigInt(channelId),
                    updates_since: updatesSince,
                }),
            selectedChannelUpdatesResponse
        );
    }

    sendMessage(
        channelId: string,
        senderName: string,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex?: number
    ): Promise<SendChannelMessageResponse> {
        const dataClient = DataClient.create(this.identity, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [channelId])
            : dataClient.uploadData(event.event.content, [channelId]);

        return uploadContentPromise.then((content) => {
            const newContent = content ?? event.event.content;
            const args = {
                channel_id: BigInt(channelId),
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
            };
            return this.handleResponse(this.service.send_message(args), sendMessageResponse);
        });
    }

    summary(): Promise<unknown> {
        return this.handleQueryResponse(() => this.service.summary({}), summaryResponse);
    }

    summaryUpdates(updatesSince: bigint): Promise<unknown> {
        return this.handleQueryResponse(
            () =>
                this.service.summary_updates({
                    updates_since: updatesSince,
                }),
            summaryUpdatesResponse
        );
    }

    toggleMuteChannelNotifications(
        channelId: string,
        mute: boolean
    ): Promise<ToggleMuteChannelNotificationsResponse> {
        return this.handleResponse(
            this.service.toggle_mute_channel_notifications({
                channel_id: BigInt(channelId),
                mute,
            }),
            toggleMuteChannelNotificationsResponse
        );
    }

    toggleMuteNotifications(mute: boolean): Promise<ToggleMuteCommunityNotificationsResponse> {
        return this.handleResponse(
            this.service.toggle_mute_notifications({
                mute,
            }),
            toggleMuteNotificationsResponse
        );
    }

    unblockUser(userId: string): Promise<UnblockCommunityUserResponse> {
        return this.handleResponse(
            this.service.unblock_user({
                user_id: Principal.fromText(userId),
            }),
            unblockUserResponse
        );
    }

    undeleteMessages(
        channelId: string,
        messageIds: bigint[],
        threadRootMessageIndex: number | undefined
    ): Promise<UndeleteChannelMessagesResponse> {
        return this.handleResponse(
            this.service.undelete_messages({
                channel_id: BigInt(channelId),
                message_ids: messageIds,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            undeleteMessagesResponse
        );
    }

    updateChannel(
        channelId: string,
        name?: string,
        description?: string,
        rules?: AccessRules,
        permissions?: Partial<GroupPermissions>,
        avatar?: Uint8Array,
        _banner?: Uint8Array,
        gate?: AccessGate
    ): Promise<UpdateChannelResponse> {
        return this.handleResponse(
            this.service.update_channel({
                channel_id: BigInt(channelId),
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                permissions: apiOptional(apiOptionalGroupPermissions, permissions),
                rules: apiOptional(apiGroupRules, rules),
                gate:
                    gate === undefined
                        ? { NoChange: null }
                        : gate.kind === "no_gate"
                        ? { SetToNone: null }
                        : { SetToSome: apiAccessGate(gate) },
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
                // banner:
                //     banner === undefined
                //         ? { NoChange: null }
                //         : {
                //               SetToSome: {
                //                   id: DataClient.newBlobId(),
                //                   mime_type: "image/jpg",
                //                   data: banner,
                //               },
                //           },
            }),
            updateChannelResponse
        );
    }

    updateCommunity(
        name?: string,
        description?: string,
        rules?: AccessRules,
        permissions?: Partial<CommunityPermissions>,
        avatar?: Uint8Array,
        _banner?: Uint8Array,
        gate?: AccessGate
    ): Promise<UpdateCommunityResponse> {
        return this.handleResponse(
            this.service.update_community({
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                permissions: apiOptional(apiOptionalCommunityPermissions, permissions),
                rules: apiOptional(apiGroupRules, rules),
                gate:
                    gate === undefined
                        ? { NoChange: null }
                        : gate.kind === "no_gate"
                        ? { SetToNone: null }
                        : { SetToSome: apiAccessGate(gate) },
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
                // banner:
                //     banner === undefined
                //         ? { NoChange: null }
                //         : {
                //               SetToSome: {
                //                   id: DataClient.newBlobId(),
                //                   mime_type: "image/jpg",
                //                   data: banner,
                //               },
                //           },
            }),
            updateCommunityResponse
        );
    }
}
