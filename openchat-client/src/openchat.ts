/* eslint-disable no-case-declarations */
import type { Identity } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { get, Readable, writable } from "svelte/store";
import type { StorageStatus } from "./domain/data/data";
import type { CreatedUser, IdentityState } from "./domain/user/user";
import { userAvatarUrl } from "./domain/user/user.utils";
import { login, startSession } from "./services/auth";
import { showTrace } from "./services/common/profiling";
import { Poller } from "./services/poller";
import { ServiceContainer } from "./services/serviceContainer";
import { idbAuthClientStore, selectedAuthProviderStore } from "./stores/authProviders";
import { currentUserStore, startChatPoller } from "./stores/chat";
import { startMessagesReadTracker } from "./stores/markRead";
import { ProfileData, profileStore } from "./stores/profiling";
import {
    percentageStorageRemaining,
    percentageStorageUsed,
    storageInGb,
    storageStore,
} from "./stores/storage";
import { startUserUpdatePoller } from "./stores/user";
import { initialiseTracking } from "./utils/tracking";
import { startSwCheckPoller } from "./utils/updateSw";
import { isCanisterUrl } from "./utils/urls";

const UPGRADE_POLL_INTERVAL = 1000;
const MARK_ONLINE_INTERVAL = 61 * 1000;

export class OpenChat extends EventTarget {
    private _authClient: Promise<AuthClient>;
    private _api: ServiceContainer | undefined;
    private _identity: Identity | undefined;
    private _user: CreatedUser | undefined;

    public identityState = writable<IdentityState>("loading_user");

    constructor() {
        super();

        localStorage.removeItem("ic-delegation");
        localStorage.removeItem("ic-identity");
        this._authClient = AuthClient.create({
            idleOptions: {
                disableIdle: true,
            },
            storage: idbAuthClientStore,
        });
        initialiseTracking();

        this._authClient.then((c) => c.getIdentity()).then((id) => this.loadedIdentity(id));
    }

    private loadedIdentity(id: Identity) {
        this._identity = id;
        const anon = id.getPrincipal().isAnonymous();
        this.identityState.set(anon ? "requires_login" : "loading_user");
        if (!anon) {
            this.loadUser(id);
        }
    }

    public login(): void {
        this.identityState.set("logging_in");
        login(get(selectedAuthProviderStore)).then((id) => this.loadedIdentity(id));
    }

    private loadUser(id: Identity) {
        this._api = new ServiceContainer(id);
        this.api
            .getCurrentUser()
            .then((user) => {
                switch (user.kind) {
                    case "unknown_user":
                        // TODO remove this once the principal migration can be done via the UI
                        const principalMigrationUserId = localStorage.getItem(
                            "openchat_principal_migration_user_id"
                        );
                        if (principalMigrationUserId !== null) {
                            console.log("Migrating user principal", principalMigrationUserId);
                            this.api.migrateUserPrincipal(principalMigrationUserId);
                            return;
                        }

                        this.identityState.set("registering");
                        break;
                    case "created_user":
                        this.onCreatedUser(user);
                        break;
                }
            })
            .catch((e) => {
                if (e.code === 403) {
                    // This happens locally if you run a new instance of the IC and have an identity based on the
                    // previous version's root key in the cache
                    this.logout();
                }
            });
    }

    public onCreatedUser(user: CreatedUser): void {
        if (this._identity === undefined) {
            throw new Error("onCreatedUser called before the user's identity has been established");
        }
        this._user = user;
        const id = this._identity;
        // TODO remove this once the principal migration can be done via the UI
        const principalMigrationNewPrincipal = localStorage.getItem(
            "openchat_principal_migration_new_principal"
        );
        if (principalMigrationNewPrincipal !== null) {
            console.log("Initializing user principal migration", principalMigrationNewPrincipal);
            this.api.createUserClient(user.userId);
            this.api.initUserPrincipalMigration(principalMigrationNewPrincipal);
            return;
        }

        if (user.canisterUpgradeStatus === "in_progress") {
            this.identityState.set("upgrading_user");
            window.setTimeout(() => this.loadUser(id), UPGRADE_POLL_INTERVAL);
        } else {
            currentUserStore.set(user);
            this.api.createUserClient(user.userId);
            startMessagesReadTracker(this.api);
            this.startOnlinePoller();
            startSwCheckPoller();
            startSession(id).then(() => this.logout());
            startChatPoller(this.api);
            startUserUpdatePoller(this.api);
            this.api.getUserStorageLimits();
            this.identityState.set("logged_in");

            if (isCanisterUrl) {
                // FIXME - not sure what to do about this
                // unsubscribeNotifications(api);
            }
        }
    }

    private startOnlinePoller() {
        new Poller(
            () => this.api.markAsOnline() ?? Promise.resolve(),
            MARK_ONLINE_INTERVAL,
            undefined,
            true
        );
    }

    public logout(): Promise<void> {
        return this._authClient.then((c) => {
            return c.logout().then(() => window.location.reload());
        });
    }

    public showTrace(): boolean {
        return showTrace();
    }

    public get isCanisterUrl(): boolean {
        return isCanisterUrl;
    }

    // FIXME - find a way to automatically proxy openChat.doStuff to openChat.api.doStuff without having to write a bunch of code
    // so that we don't have to type client.api.doStuff in the calling code
    public get api(): ServiceContainer {
        if (this._api === undefined)
            throw new Error("OpenChat tried to make an api call before the api was available");
        return this._api;
    }

    public get hasUser(): boolean {
        return this._user !== undefined;
    }

    public get user(): CreatedUser {
        if (this._user === undefined) {
            throw new Error("OpenChat tried to access the current user before it has been set");
        }
        return this._user;
    }

    public get profileStore(): Readable<ProfileData> {
        return profileStore;
    }

    public userAvatarUrl<T extends { blobUrl?: string }>(dataContent?: T): string {
        return userAvatarUrl(dataContent);
    }

    /**
     * Reactive state provided in the form of svelte stores
     */
    public get percentageStorageRemaining(): Readable<number> {
        return percentageStorageRemaining;
    }

    public get percentageStorageUsed(): Readable<number> {
        return percentageStorageUsed;
    }

    public get storageStore(): Readable<StorageStatus> {
        return storageStore;
    }

    public get storageInGb(): typeof storageInGb {
        return storageInGb;
    }
}
