/* eslint-disable no-case-declarations */
import type { Identity } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { get, Readable, writable } from "svelte/store";
import type { CreatedUser, IdentityState } from "./domain/user/user";
import { login, startSession } from "./services/auth";
import { Poller } from "./services/poller";
import { ServiceContainer } from "./services/serviceContainer";
import { idbAuthClientStore, selectedAuthProviderStore } from "./stores/authProviders";
import { currentUserStore, startChatPoller } from "./stores/chat";
import { startMessagesReadTracker } from "./stores/markRead";
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

    public get currentUserStore(): Readable<CreatedUser | undefined> {
        return currentUserStore;
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
        this._api
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
                            this._api?.migrateUserPrincipal(principalMigrationUserId);
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
        const id = this._identity;
        // TODO remove this once the principal migration can be done via the UI
        const principalMigrationNewPrincipal = localStorage.getItem(
            "openchat_principal_migration_new_principal"
        );
        if (principalMigrationNewPrincipal !== null) {
            console.log("Initializing user principal migration", principalMigrationNewPrincipal);
            this._api?.createUserClient(user.userId);
            this._api?.initUserPrincipalMigration(principalMigrationNewPrincipal);
            return;
        }

        if (user.canisterUpgradeStatus === "in_progress") {
            this.identityState.set("upgrading_user");
            window.setTimeout(() => this.loadUser(id), UPGRADE_POLL_INTERVAL);
        } else {
            currentUserStore.set(user);
            this._api?.createUserClient(user.userId);
            startMessagesReadTracker(this._api!);
            this.startOnlinePoller();
            startSwCheckPoller();
            startSession(id).then(() => this.logout());
            startChatPoller(this._api!);
            startUserUpdatePoller(this._api!);
            this._api?.getUserStorageLimits();
            this.identityState.set("logged_in");

            if (isCanisterUrl) {
                // FIXME - not sure what to do about this
                // unsubscribeNotifications(api);
            }
        }
    }

    private startOnlinePoller() {
        new Poller(
            () => this._api?.markAsOnline() ?? Promise.resolve(),
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
        return this.showTrace();
    }

    public get isCanisterUrl(): boolean {
        return isCanisterUrl;
    }

    public get api(): ServiceContainer {
        if (this._api === undefined)
            throw new Error("OpenChat tried to make an api call before the api was available");
        return this._api;
    }
}
