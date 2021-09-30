import type { Identity } from "@dfinity/agent";
import type {
    CurrentUserResponse,
    SetUsernameResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersResponse,
    UserSummary,
    UpgradeCanisterResponse,
    CreateCanisterResponse,
} from "../domain/user/user";
import type { IUserIndexClient } from "./userIndex/userIndex.client.interface";
import type { IUserClient } from "./user/user.client.interface";
import Identicon from "identicon.js";
import md5 from "md5";
import type {
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
    DirectChatEvent,
    GroupChatEvent,
    ChatEvent,
    ChatSummary,
    MergedUpdatesResponse,
    AddParticipantsResponse,
    Message,
    SendMessageResponse,
    ChangeAdminResponse,
    RemoveParticipantResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MessageIndexRange,
    MarkReadResponse,
    UpdateGroupResponse,
    ToggleReactionResponse,
    IndexRange,
    EventWrapper,
    DeleteMessageResponse,
    JoinGroupResponse,
    EditMessageResponse,
} from "../domain/chat/chat";
import type { IGroupClient } from "./group/group.client.interface";
import { Database, db } from "../utils/caching";
import type { IGroupIndexClient } from "./groupIndex/groupIndex.client.interface";
import { UserIndexClient } from "./userIndex/userIndex.client";
import { UserClient } from "./user/user.client";
import { GroupClient } from "./group/group.client";
import type { BlobReference, DataContent } from "../domain/data/data";
import { UnsupportedValueError } from "../utils/error";
import type { GroupSearchResponse, SearchAllMessagesResponse } from "../domain/search/search";
import { GroupIndexClient } from "./groupIndex/groupIndex.client";

function buildIdenticonUrl(userId: string) {
    const identicon = new Identicon(md5(userId), {
        margin: 0,
        format: "svg",
        // background: [230, 230, 230, 230],
    });
    return `data:image/svg+xml;base64,${identicon}`;
}

export class ServiceContainer {
    private _userIndexClient: IUserIndexClient;
    private _groupIndexClient: IGroupIndexClient;
    private _userClient?: IUserClient;
    private _groupClients: Record<string, IGroupClient>;
    private db?: Database;

    constructor(private identity: Identity) {
        this._userIndexClient = UserIndexClient.create(identity);
        this._groupIndexClient = GroupIndexClient.create(identity);
        this._groupClients = {};
        this.db = db;
    }

    createUserClient(userId: string): ServiceContainer {
        this._userClient = UserClient.create(userId, this.identity, this.db);
        return this;
    }

    private getGroupClient(chatId: string): IGroupClient {
        if (!this._groupClients[chatId]) {
            this._groupClients[chatId] = GroupClient.create(chatId, this.identity, this.db);
        }
        return this._groupClients[chatId];
    }

    private get userClient(): IUserClient {
        if (this._userClient) {
            return this._userClient;
        }
        throw new Error("Attempted to use the user client before it has been initialised");
    }

    editMessage(chat: ChatSummary, msg: Message): Promise<EditMessageResponse> {
        if (chat.kind === "group_chat") {
            return this.editGroupMessage(chat.chatId, msg);
        }
        if (chat.kind === "direct_chat") {
            return this.editDirectMessage(chat.them, msg);
        }
        throw new UnsupportedValueError("Unexpect chat type", chat);
    }

    sendMessage(chat: ChatSummary, user: UserSummary, msg: Message): Promise<SendMessageResponse> {
        if (chat.kind === "group_chat") {
            return this.sendGroupMessage(chat.chatId, user.username, msg);
        }
        if (chat.kind === "direct_chat") {
            const replyingToChatId =
                msg.repliesTo && chat.chatId !== msg.repliesTo.chatId
                    ? msg.repliesTo.chatId
                    : undefined;
            return this.sendDirectMessage(chat.them, user, msg, replyingToChatId);
        }
        throw new UnsupportedValueError("Unexpect chat type", chat);
    }

    private sendGroupMessage(
        chatId: string,
        senderName: string,
        message: Message
    ): Promise<SendMessageResponse> {
        return this.getGroupClient(chatId).sendMessage(senderName, message);
    }

    private editGroupMessage(chatId: string, message: Message): Promise<EditMessageResponse> {
        return this.getGroupClient(chatId).editMessage(message);
    }

    private sendDirectMessage(
        recipientId: string,
        sender: UserSummary,
        message: Message,
        replyingToChatId?: string
    ): Promise<SendMessageResponse> {
        return this.userClient.sendMessage(recipientId, sender, message, replyingToChatId);
    }

    private editDirectMessage(recipientId: string, message: Message): Promise<EditMessageResponse> {
        return this.userClient.editMessage(recipientId, message);
    }

    createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.userClient.createGroup(candidate);
    }

    updateGroup(
        chatId: string,
        name: string,
        desc: string,
        avatar?: Uint8Array
    ): Promise<UpdateGroupResponse> {
        return this.getGroupClient(chatId).updateGroup(name, desc, avatar);
    }

    addParticipants(chatId: string, userIds: string[]): Promise<AddParticipantsResponse> {
        return this.getGroupClient(chatId).addParticipants(userIds);
    }

    directChatEvents(
        eventIndexRange: IndexRange,
        theirUserId: string,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateMediaData(
            this.userClient.chatEvents(eventIndexRange, theirUserId, startIndex, ascending)
        );
    }

    groupChatEvents(
        eventIndexRange: IndexRange,
        chatId: string,
        startIndex: number,
        ascending: boolean
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateMediaData(
            this.getGroupClient(chatId).chatEvents(eventIndexRange, startIndex, ascending)
        );
    }

    private reydrateEventList<T extends ChatEvent>(events: EventWrapper<T>[]): EventWrapper<T>[] {
        return events.map((e) => {
            if (e.event.kind === "message") {
                if (
                    (e.event.content.kind === "file_content" ||
                        e.event.content.kind === "image_content" ||
                        e.event.content.kind === "audio_content") &&
                    e.event.content.blobReference !== undefined
                ) {
                    e.event.content = this.rehydrateDataContent(e.event.content, "blobs");
                }
                if (e.event.content.kind === "video_content") {
                    e.event.content.videoData = this.rehydrateDataContent(
                        e.event.content.videoData,
                        "blobs"
                    );
                    e.event.content.imageData = this.rehydrateDataContent(
                        e.event.content.imageData,
                        "blobs"
                    );
                }
            }
            return e;
        });
    }

    private async rehydrateMediaData<T extends ChatEvent>(
        eventsPromise: Promise<EventsResponse<T>>
    ): Promise<EventsResponse<T>> {
        const resp = await eventsPromise;

        if (resp === "chat_not_found") {
            return resp;
        }

        resp.events = this.reydrateEventList(resp.events);
        resp.affectedEvents = this.reydrateEventList(resp.affectedEvents);
        return resp;
    }

    rehydrateDataContent<T extends DataContent>(
        dataContent: T,
        blobType: "blobs" | "avatar",
        key?: string
    ): T {
        if (dataContent.blobReference !== undefined) {
            dataContent.blobData = undefined;
            dataContent.blobUrl = `${"process.env.BLOB_URL_PATTERN"
                .replace("{canisterId}", dataContent.blobReference.canisterId)
                .replace("{blobType}", blobType)}${dataContent.blobReference.blobId}`;
        } else {
            if (blobType === "avatar" && key) {
                dataContent.blobUrl = buildIdenticonUrl(key);
            }
        }
        return dataContent;
    }

    searchUsers(searchTerm: string, maxResults = 20): Promise<UserSummary[]> {
        return this._userIndexClient
            .searchUsers(searchTerm, maxResults)
            .then((users) => users.map((u) => this.rehydrateDataContent(u, "avatar", u.userId)));
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        return this._groupIndexClient.search(searchTerm, maxResults).then((res) => {
            if (res.kind === "success") {
                return {
                    ...res,
                    matches: res.matches.map((match) =>
                        this.rehydrateDataContent(match, "avatar", match.chatId)
                    ),
                };
            }
            return res;
        });
    }

    searchAllMessages(searchTerm: string, maxResults = 10): Promise<SearchAllMessagesResponse> {
        return this.userClient.searchAllMessages(searchTerm, maxResults);
    }

    getUsers(userIds: string[], since: bigint): Promise<UsersResponse> {
        return this._userIndexClient.getUsers(userIds, since).then((resp) => ({
            timestamp: resp.timestamp,
            users: resp.users.map((u) => this.rehydrateDataContent(u, "avatar", u.userId)),
        }));
    }

    getUpdates(chatSummaries: ChatSummary[], args: UpdateArgs): Promise<MergedUpdatesResponse> {
        return this.userClient.getUpdates(chatSummaries, args).then((resp) => {
            return {
                ...resp,
                chatSummaries: resp.chatSummaries.map((chat) => {
                    return chat.kind === "direct_chat"
                        ? chat
                        : this.rehydrateDataContent(chat, "avatar", chat.chatId);
                }),
            };
        });
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this._userIndexClient.getCurrentUser();
    }

    upgradeUser(): Promise<UpgradeCanisterResponse> {
        return this._userIndexClient.upgradeUser();
    }

    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
        return this._userIndexClient.submitPhoneNumber(phoneNumber);
    }

    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return this._userIndexClient.resendRegistrationCode();
    }

    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse> {
        return this._userIndexClient.confirmPhoneNumber(code);
    }

    setUsername(username: string): Promise<SetUsernameResponse> {
        return this._userIndexClient.setUsername(username);
    }

    createCanister(): Promise<CreateCanisterResponse> {
        return this._userIndexClient.createCanister();
    }

    differentIdentity(identity: Identity): boolean {
        return identity.getPrincipal().toText() !== this.identity.getPrincipal().toText();
    }

    makeAdmin(chatId: string, userId: string): Promise<ChangeAdminResponse> {
        return this.getGroupClient(chatId).makeAdmin(userId);
    }

    dismissAsAdmin(chatId: string, userId: string): Promise<ChangeAdminResponse> {
        return this.getGroupClient(chatId).dismissAsAdmin(userId);
    }

    removeParticipant(chatId: string, userId: string): Promise<RemoveParticipantResponse> {
        return this.getGroupClient(chatId).removeParticipant(userId);
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.userClient.blockUser(userId);
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.userClient.unblockUser(userId);
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        return this.userClient.leaveGroup(chatId);
    }

    joinGroup(chatId: string): Promise<JoinGroupResponse> {
        return this.userClient.joinGroup(chatId);
    }

    markDirectChatMessagesRead(
        userId: string,
        ranges: MessageIndexRange[]
    ): Promise<MarkReadResponse> {
        return this.userClient.markMessagesRead(userId, ranges);
    }

    markGroupChatMessagesRead(
        chatId: string,
        ranges: MessageIndexRange[]
    ): Promise<MarkReadResponse> {
        return this.getGroupClient(chatId).markMessagesRead(ranges);
    }

    setUserAvatar(data: Uint8Array): Promise<BlobReference> {
        return this.userClient.setAvatar(data);
    }

    toggleGroupChatReaction(
        chatId: string,
        messageId: bigint,
        reaction: string
    ): Promise<ToggleReactionResponse> {
        return this.getGroupClient(chatId).toggleReaction(messageId, reaction);
    }

    toggleDirectChatReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string
    ): Promise<ToggleReactionResponse> {
        return this.userClient.toggleReaction(otherUserId, messageId, reaction);
    }

    deleteGroupMessage(chatId: string, messageId: bigint): Promise<DeleteMessageResponse> {
        return this.getGroupClient(chatId).deleteMessage(messageId);
    }

    deleteDirectMessage(otherUserId: string, messageId: bigint): Promise<DeleteMessageResponse> {
        return this.userClient.deleteMessage(otherUserId, messageId);
    }

    markAsOnline(): Promise<void> {
        return this._userIndexClient.markAsOnline();
    }
}
