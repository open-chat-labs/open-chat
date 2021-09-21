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
    GroupMessage,
    SendMessageResponse,
    DirectMessage,
    ChangeAdminResponse,
    RemoveParticipantResponse,
    BlockUserResponse,
    UnblockUserResponse,
    LeaveGroupResponse,
    MessageIndexRange,
    MarkReadResponse,
} from "../domain/chat/chat";
import type { IGroupClient } from "./group/group.client.interface";
import { Database, db } from "../utils/caching";
import type { IGroupIndexClient } from "./groupIndex/groupIndex.client.interface";
import { GroupIndexClientMock } from "./groupIndex/groupIndex.client.mock";
import { UserIndexClient } from "./userIndex/userIndex.client";
import { UserClient } from "./user/user.client";
import { GroupClient } from "./group/group.client";
import type { BlobReference, DataContent } from "../domain/data/data";

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
        this._groupIndexClient = new GroupIndexClientMock();
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

    sendMessage(
        chat: ChatSummary,
        user: UserSummary,
        msg: GroupMessage | DirectMessage
    ): Promise<SendMessageResponse> {
        if (chat.kind === "group_chat" && msg.kind === "group_message") {
            return this.sendGroupMessage(chat.chatId, user.username, msg);
        }
        if (chat.kind === "direct_chat" && msg.kind === "direct_message") {
            return this.sendDirectMessage(chat.them, user.username, msg);
        }
        throw new Error(`Unexpected chat type and msg type combination: ${chat.kind}, ${msg.kind}`);
    }

    private sendGroupMessage(
        chatId: string,
        senderName: string,
        message: GroupMessage
    ): Promise<SendMessageResponse> {
        return this.getGroupClient(chatId).sendMessage(senderName, message);
    }

    private sendDirectMessage(
        recipientId: string,
        senderName: string,
        message: DirectMessage
    ): Promise<SendMessageResponse> {
        return this.userClient.sendMessage(recipientId, senderName, message);
    }

    createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.userClient.createGroup(candidate);
    }

    addParticipants(chatId: string, userIds: string[]): Promise<AddParticipantsResponse> {
        return this.getGroupClient(chatId).addParticipants(userIds);
    }

    directChatEvents(
        theirUserId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateMediaData(this.userClient.chatEvents(theirUserId, fromIndex, toIndex));
    }

    groupChatEvents(
        chatId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<EventsResponse<GroupChatEvent>> {
        return this.rehydrateMediaData(this.getGroupClient(chatId).chatEvents(fromIndex, toIndex));
    }

    private async rehydrateMediaData<T extends ChatEvent>(
        eventsPromise: Promise<EventsResponse<T>>
    ): Promise<EventsResponse<T>> {
        const resp = await eventsPromise;

        if (resp === "chat_not_found") {
            return resp;
        }

        resp.events = resp.events.map((e) => {
            if (e.event.kind === "direct_message" || e.event.kind === "group_message") {
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

    searchUsers(searchTerm: string): Promise<UserSummary[]> {
        return this._userIndexClient
            .searchUsers(searchTerm)
            .then((users) => users.map((u) => this.rehydrateDataContent(u, "avatar", u.userId)));
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
        return this._userIndexClient.getCurrentUser().then((user) => {
            console.log(user);
            return user;
        });
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
}
