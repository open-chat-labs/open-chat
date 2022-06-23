import type { Identity } from "@dfinity/agent";
import { apiStore } from "stores/api";
import { currentUserStore } from "../stores/chat";
import { Writable, writable } from "svelte/store";
import type { CreatedUser, User } from "../domain/user/user";
import { getIdentity, login, logout, startSession } from "../services/auth";
import { ServiceContainer } from "../services/serviceContainer";
// import { HomeController } from "./home.controller";
import { Poller } from "./poller";
import { RegisterController } from "./register.controller";

type IdentityState =
    | "requires_login"
    | "loading_user"
    | "logged_in"
    | "registering"
    | "logging_in"
    | "upgrading_user"
    | "upgrade_user"
    | "expired";

const UPGRADE_POLL_INTERVAL = 1000;
const MARK_ONLINE_INTERVAL = 61 * 1000;

export class IdentityController {
    public state: Writable<IdentityState> = writable("requires_login");
    private _identity?: Identity;
    private _api?: ServiceContainer;
    public registerController?: RegisterController;
    // public homeController?: HomeController;
    private _user?: User;
    private markOnlinePoller: Poller | undefined;
    private _referredBy: string | undefined = undefined;

    constructor() {
        getIdentity().then((id) => this.loadedIdentity(id));
    }

    private loadedIdentity(id: Identity) {
        this._identity = id;
        const anon = id.getPrincipal().isAnonymous();
        this.state.set(anon ? "requires_login" : "loading_user");
        if (!anon) {
            this.loadUser(id);
        }
    }

    private loadUser(id: Identity) {
        if (this._api === undefined || this._api.differentIdentity(id)) {
            this._api = new ServiceContainer(id);
        }
        this._api.getCurrentUser().then((user) => {
            switch (user.kind) {
                case "unknown_user":
                    this.state.set("registering");
                    this.registerController = new RegisterController(
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        this._api!,
                        user,
                        (registeredUser) => this.onCreatedUser(id, registeredUser),
                        this._referredBy
                    );
                    break;
                case "created_user":
                    this.onCreatedUser(id, user);
                    break;
            }
        });
    }

    private onCreatedUser(id: Identity, user: CreatedUser): void {
        if (user.canisterUpgradeStatus === "in_progress") {
            this.state.set("upgrading_user");
            window.setTimeout(() => this.loadUser(id), UPGRADE_POLL_INTERVAL);
        } else {
            this.state.set("logged_in");
            this._api?.createUserClient(user.userId);
            currentUserStore.set(user);
            apiStore.set(this._api);
            this._user = { ...user };
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            // this.homeController = new HomeController(this._api!, user);

            this.startOnlinePoller();
            this.startSession(id);
        }
    }

    private startOnlinePoller() {
        this._api?.markAsOnline();
        this.markOnlinePoller = new Poller(
            () => this._api?.markAsOnline() ?? Promise.resolve(),
            MARK_ONLINE_INTERVAL
        );
    }

    private startSession(id: Identity) {
        startSession(id).then(() => this.endSession());
    }

    public endSession(): void {
        this.logout().then(() => this.state.set("expired"));
    }

    public logout(): Promise<void> {
        return logout().then(() => {
            this._identity = undefined;
            this._api = undefined;
            this._user = undefined;
            // this.homeController = undefined;
            this.markOnlinePoller?.stop();
            this.markOnlinePoller = undefined;
            this.state.set("requires_login");
            currentUserStore.set(undefined);
            return;
        });
    }

    public login(): void {
        this.state.set("logging_in");
        login().then((id) => this.loadedIdentity(id));
    }

    public acknowledgeExpiry(): void {
        this.login();
    }
}
