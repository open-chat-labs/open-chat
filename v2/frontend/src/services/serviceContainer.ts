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
    UpdatesResponse,
    EventsResponse,
    UpdateArgs,
    CandidateGroupChat,
    CreateGroupResponse,
    BlobReference,
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
import { ChatSchema, openMessageCache } from "../utils/caching";
import type { IGroupIndexClient } from "./groupIndex/groupIndex.client.interface";
import { GroupIndexClientMock } from "./groupIndex/groupIndex.client.mock";
import { CachingDataClient } from "./data/data.caching.client";
import type { IDataClient } from "./data/data.client.interface";
import { DataClientMock } from "./data/data.client.mock";

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
        this.db = openMessageCache();
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

    directChatEvents(userId: string, fromIndex: number, toIndex: number): Promise<EventsResponse> {
        return this.rehydrateMediaData(this.userClient.chatEvents(userId, fromIndex, toIndex));
    }

    groupChatEvents(chatId: string, fromIndex: number, toIndex: number): Promise<EventsResponse> {
        return this.rehydrateMediaData(this.getGroupClient(chatId).chatEvents(fromIndex, toIndex));
    }

    private async rehydrateMediaData(
        eventsPromise: Promise<EventsResponse>
    ): Promise<EventsResponse> {
        const resp = await eventsPromise;

        if (resp === "chat_not_found" || resp === "not_authorised") {
            return resp;
        }

        resp.events = resp.events.map((e) => {
            if (e.event.kind === "message") {
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

                // if (
                //     e.event.content.kind === "media_content" ||
                //     e.event.content.kind === "file_content"
                // ) {
                //     e.event.content.blobData = this.getMediaData(e.event.content.blobReference);
                // }
            }
            return e;
        });
        return resp;
    }

    private getMediaData(blobRef?: BlobReference): Promise<Uint8Array | undefined> {
        if (!blobRef) return Promise.resolve(undefined);

        // todo - swap this when we have the real service
        // let client: IDataClient = new DataClient(
        //     this.identity,
        //     Principal.fromText(blobRef.canisterId)
        // );
        let client: IDataClient = new DataClientMock();
        if (this.db) {
            client = new CachingDataClient(this.db, client);
        }
        return Promise.resolve(client.getData(blobRef.blobId, blobRef.blobSize, blobRef.chunkSize));
    }

    searchUsers(searchTerm: string): Promise<UserSummary[]> {
        return this.userIndexClient.searchUsers(searchTerm);
    }

    getUsers(userIds: string[], since: bigint): Promise<UsersResponse> {
        return this.userIndexClient.getUsers(userIds, since);
    }

    getUpdates(userId: string, args: UpdateArgs): Promise<UpdatesResponse> {
        return this.userClient.getUpdates(userId, args);
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
