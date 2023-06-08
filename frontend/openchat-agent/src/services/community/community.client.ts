/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Identity } from "@dfinity/agent";
import { idlFactory, CommunityService } from "./candid/idl";
import { CandidService } from "../candidService";
import { toVoid } from "../../utils/mapping";
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
    eventsResponse,
    inviteCodeResponse,
    joinChannelResponse,
    leaveChannelResponse,
    localUserIndexResponse,
    makeChannelPrivateResponse,
    makePrivateResponse,
    messageByMessageIndexResponse,
    pinMessageResponse,
    removeMemberResponse,
    removeMemberFromChannelResponse,
    removeReactionResponse,
    resetInviteCodeResponse,
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
} from "./mappers";

export class CommunityClient extends CandidService {
    private service: CommunityService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<CommunityService>(
            idlFactory,
            config.notificationsCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): CommunityClient {
        return new CommunityClient(identity, config);
    }

    addMembersToChannel(): Promise<unknown> {
        return this.handleResponse(
            this.service.add_members_to_channel({}),
            addMembersToChannelResponse
        );
    }

    addReaction(): Promise<unknown> {
        return this.handleResponse(this.service.add_reaction({}), addReactionResponse);
    }

    blockUser(): Promise<unknown> {
        return this.handleResponse(this.service.block_user({}), blockUserResponse);
    }

    changeChannelRole(): Promise<unknown> {
        return this.handleResponse(this.service.change_channel_role({}), changeChannelRoleResponse);
    }

    changeRole(): Promise<unknown> {
        return this.handleResponse(this.service.change_role({}), changeRoleResponse);
    }

    createChannel(): Promise<unknown> {
        return this.handleResponse(this.service.create_channel({}), createChannelResponse);
    }

    declineInvitation(): Promise<unknown> {
        return this.handleResponse(this.service.decline_invitation({}), declineInvitationResponse);
    }

    deleteChannel(): Promise<unknown> {
        return this.handleResponse(this.service.delete_channel({}), deleteChannelResponse);
    }

    deleteMessages(): Promise<unknown> {
        return this.handleResponse(this.service.delete_messages({}), deleteMessagesResponse);
    }

    deleteMessage(): Promise<unknown> {
        return this.handleResponse(this.service.deleted_message({}), deleteMessageResponse);
    }

    disableInviteCode(): Promise<unknown> {
        return this.handleResponse(this.service.disable_invite_code({}), disableInviteCodeResponse);
    }

    editMessage(): Promise<unknown> {
        return this.handleResponse(this.service.edit_message({}), editMessageResponse);
    }

    enableInviteCode(): Promise<unknown> {
        return this.handleResponse(this.service.enable_invite_code({}), enableInviteCodeResponse);
    }

    events(): Promise<unknown> {
        return this.handleResponse(this.service.events({}), eventsResponse);
    }

    eventsByIndex(): Promise<unknown> {
        return this.handleResponse(this.service.events_by_index({}), eventsResponse);
    }

    eventsWindow(): Promise<unknown> {
        return this.handleResponse(this.service.events_window({}), eventsResponse);
    }

    inviteCode(): Promise<unknown> {
        return this.handleResponse(this.service.invite_code({}), inviteCodeResponse);
    }

    joinChannel(): Promise<unknown> {
        return this.handleResponse(this.service.join_channel({}), joinChannelResponse);
    }

    leaveChannel(): Promise<unknown> {
        return this.handleResponse(this.service.leave_channel({}), leaveChannelResponse);
    }

    localUserIndex(): Promise<unknown> {
        return this.handleResponse(this.service.local_user_index({}), localUserIndexResponse);
    }

    makeChannelPrivate(): Promise<unknown> {
        return this.handleResponse(
            this.service.make_channel_private({}),
            makeChannelPrivateResponse
        );
    }

    makePrivate(): Promise<unknown> {
        return this.handleResponse(this.service.make_private({}), makePrivateResponse);
    }

    messageByMessageIndex(): Promise<unknown> {
        return this.handleResponse(
            this.service.messages_by_message_index({}),
            messageByMessageIndexResponse
        );
    }

    pinMessage(): Promise<unknown> {
        return this.handleResponse(this.service.pin_message({}), pinMessageResponse);
    }

    removeMember(): Promise<unknown> {
        return this.handleResponse(this.service.remove_member({}), removeMemberResponse);
    }

    removeMemberFromChannel(): Promise<unknown> {
        return this.handleResponse(
            this.service.remove_member_from_channel({}),
            removeMemberFromChannelResponse
        );
    }

    removeReaction(): Promise<unknown> {
        return this.handleResponse(this.service.remove_reaction({}), removeReactionResponse);
    }

    resetInviteCode(): Promise<unknown> {
        return this.handleResponse(this.service.reset_invite_code({}), resetInviteCodeResponse);
    }

    rules(): Promise<unknown> {
        return this.handleResponse(this.service.rules({}), rulesResponse);
    }

    searchChannel(): Promise<unknown> {
        return this.handleResponse(this.service.search_channel({}), searchChannelResponse);
    }

    selectedChannelInitial(): Promise<unknown> {
        return this.handleResponse(
            this.service.selected_channel_initial({}),
            selectedChannelInitialResponse
        );
    }

    selectedChannelUpdates(): Promise<unknown> {
        return this.handleResponse(
            this.service.selected_channel_updates({}),
            selectedChannelUpdatesResponse
        );
    }

    sendMessage(): Promise<unknown> {
        return this.handleResponse(this.service.send_message({}), sendMessageResponse);
    }

    summary(): Promise<unknown> {
        return this.handleResponse(this.service.summary({}), summaryResponse);
    }

    summaryUpdates(): Promise<unknown> {
        return this.handleResponse(this.service.summary_updates({}), summaryUpdatesResponse);
    }

    toggleMuteChannelNotifications(): Promise<unknown> {
        return this.handleResponse(
            this.service.toggle_mute_channel_notifications({}),
            toggleMuteChannelNotificationsResponse
        );
    }

    toggleMuteNotifications(): Promise<unknown> {
        return this.handleResponse(
            this.service.toggle_mute_notifications({}),
            toggleMuteNotificationsResponse
        );
    }

    unblockUser(): Promise<unknown> {
        return this.handleResponse(this.service.unblock_user({}), unblockUserResponse);
    }

    undeleteMessages(): Promise<unknown> {
        return this.handleResponse(this.service.undelete_messages({}), undeleteMessagesResponse);
    }

    updateChannel(): Promise<unknown> {
        return this.handleResponse(this.service.update_channel({}), updateChannelResponse);
    }

    updateCommunity(): Promise<unknown> {
        return this.handleResponse(this.service.update_community({}), updateCommunityResponse);
    }
}
