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
import { UserIndexClientMock } from "./userIndex/userIndex.client.mock";
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
} from "../domain/chat/chat";
// import { UserClient } from "./user/user.client";
import { UserClientMock } from "./user/user.client.mock";
import type { IGroupClient } from "./group/group.client.interface";
// import { GroupClient } from "./group/group.client";
// import { GroupIndexClient } from "./groupIndex/groupIndex.client";
// import { Principal } from "@dfinity/principal";
// import { DataClient } from "./data/data.client";
import { GroupClientMock } from "./group/group.client.mock";
import { CachingUserClient } from "./user/user.caching.client";
import { CachingGroupClient } from "./group/group.caching.client";
import type { IDBPDatabase } from "idb";
import { ChatSchema, db } from "../utils/caching";
import type { IGroupIndexClient } from "./groupIndex/groupIndex.client.interface";
import { GroupIndexClientMock } from "./groupIndex/groupIndex.client.mock";
import { DataClient } from "./data/data.client";

export class ServiceContainer {
    private userIndexClient: IUserIndexClient;
    private groupIndexClient: IGroupIndexClient;
    private _userClient?: IUserClient;
    private _groupClients: Record<string, IGroupClient>;
    private db?: Promise<IDBPDatabase<ChatSchema>>;

    constructor(private identity: Identity) {
        this.userIndexClient = new UserIndexClientMock();
        this.groupIndexClient = new GroupIndexClientMock();
        this._groupClients = {};
        this.db = db;
    }

    createUserClient(_userId: string): ServiceContainer {
        if (this.db) {
            this._userClient = new CachingUserClient(this.db, new UserClientMock());
        } else {
            this._userClient = new UserClientMock();
        }
        // this._userClient = new CachingUserClient(new UserClient(this.identity, userId));
        return this;
    }

    private getGroupClient(chatId: string): IGroupClient {
        if (!this._groupClients[chatId]) {
            // this._groupClients[chatId] = new GroupClient(this.identity, Principal.fromText(chatId));
            if (this.db) {
                this._groupClients[chatId] = new CachingGroupClient(
                    this.db,
                    chatId,
                    new GroupClientMock()
                );
            } else {
                this._groupClients[chatId] = new GroupClientMock();
            }
        }
        return this._groupClients[chatId];
    }

    private get userClient(): IUserClient {
        if (this._userClient) {
            return this._userClient;
        }
        throw new Error("Attempted to use the user client before it has been initialised");
    }

    createGroupChat(candidate: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.userClient.createGroup(candidate);
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

        if (resp === "chat_not_found" || resp === "not_authorised") {
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
        return DataClient.create(blobRef.canisterId).getData(blobRef);
    }

    searchUsers(searchTerm: string): Promise<UserSummary[]> {
        return this.userIndexClient.searchUsers(searchTerm);
    }

    getUsers(userIds: string[], since: bigint): Promise<UsersResponse> {
        return this.userIndexClient.getUsers(userIds, since);
    }

    getUpdates(chatSummaries: ChatSummary[], args: UpdateArgs): Promise<MergedUpdatesResponse> {
        return this.userClient.getUpdates(chatSummaries, args);
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        return this.userIndexClient.getCurrentUser();
    }

    upgradeUser(): Promise<UpgradeCanisterResponse> {
        return this.userIndexClient.upgradeUser();
    }

    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
        return this.userIndexClient.submitPhoneNumber(phoneNumber);
    }

    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return this.userIndexClient.resendRegistrationCode();
    }

    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse> {
        return this.userIndexClient.confirmPhoneNumber(code);
    }

    setUsername(username: string): Promise<SetUsernameResponse> {
        return this.userIndexClient.setUsername(username);
    }

    createCanister(): Promise<CreateCanisterResponse> {
        return this.userIndexClient.createCanister();
    }
}
