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
import type {
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
    BlobReference,
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
} from "../domain/chat/chat";
import type { IGroupClient } from "./group/group.client.interface";
import { Database, db } from "../utils/caching";
import type { IGroupIndexClient } from "./groupIndex/groupIndex.client.interface";
import { GroupIndexClientMock } from "./groupIndex/groupIndex.client.mock";
import { DataClient } from "./data/data.client";
import { UserIndexClient } from "./userIndex/userIndex.client";
import { UserClient } from "./user/user.client";
import { GroupClient } from "./group/group.client";

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

    getIdentity(): Identity {
        return this.identity;
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
        userId: string,
        fromIndex: number,
        toIndex: number
    ): Promise<EventsResponse<DirectChatEvent>> {
        return this.rehydrateMediaData(this.userClient.chatEvents(userId, fromIndex, toIndex));
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
                    e.event.content.kind === "media_content" &&
                    /^image/.test(e.event.content.mimeType)
                ) {
                    e.event.content.blobData = this.getMediaData(e.event.content.blobReference);
                } else if (
                    e.event.content.kind === "media_content" ||
                    e.event.content.kind === "file_content"
                ) {
                    e.event.content.blobData = Promise.resolve(undefined);
                }
            }
            return e;
        });
        return resp;
    }

    private getMediaData(blobRef?: BlobReference): Promise<Uint8Array | undefined> {
        if (!blobRef) return Promise.resolve(undefined);
        return DataClient.create(this.identity, blobRef.canisterId).getData(blobRef);
    }

    searchUsers(searchTerm: string): Promise<UserSummary[]> {
        return this._userIndexClient.searchUsers(searchTerm);
    }

    getUsers(userIds: string[], since: bigint): Promise<UsersResponse> {
        return this._userIndexClient.getUsers(userIds, since);
    }

    getUpdates(chatSummaries: ChatSummary[], args: UpdateArgs): Promise<MergedUpdatesResponse> {
        return this.userClient.getUpdates(chatSummaries, args);
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
}
