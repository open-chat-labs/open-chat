import { Actor, Agent, HttpAgent, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { Option } from "../domain/model/common";
import { _SERVICE as ChatsService } from "./chats/candid/types";
import { _SERVICE as P2pService } from "./p2p/candid/types";
import { _SERVICE as UserMgmtService } from "./userMgmt/candid/types";
import { _SERVICE as NotificationsService } from "./notifications/candid/types";
import { idlFactory as chatsIdlFactory } from "./chats/candid/idl";
import { idlFactory as p2pIdlFactory } from "./p2p/candid/idl";
import { idlFactory as userMgmtIdlFactory } from "./userMgmt/candid/idl";
import { idlFactory as notificationsIdlFactory } from "./notifications/candid/idl";

export default class CanisterClientFactory {
    private readonly _chatsActor: ChatsService;
    private readonly _p2pActor: P2pService;
    private readonly _userMgmtActor: UserMgmtService;
    private readonly _notificationsActor: NotificationsService;

    public static init = async (identity: Identity) : Promise<void> => {
        if (identity.getPrincipal().isAnonymous()) {
            throw new Error("Cannot use the anonymous identity");
        }

        const agent = new HttpAgent({ identity });

        // Fetch root key for certificate validation during development
        if (process.env.NODE_ENV !== "production") {
            agent.fetchRootKey();
        }

        CanisterClientFactory.current = new CanisterClientFactory(agent);
    }

    private constructor(agent: HttpAgent) {
        let chatsId = Principal.fromText(process.env.CHATS_CANISTER_ID!);
        let p2pId = Principal.fromText(process.env.P2P_CANISTER_ID!);
        let userMgmtId = Principal.fromText(process.env.USER_MGMT_CANISTER_ID!);
        let notificationsId = Principal.fromText(process.env.NOTIFICATIONS_CANISTER_ID!);
    
        this._chatsActor = this.createActor<ChatsService>(agent, chatsId, chatsIdlFactory);
        this._p2pActor = this.createActor<P2pService>(agent, p2pId, p2pIdlFactory);
        this._userMgmtActor = this.createActor<UserMgmtService>(agent, userMgmtId, userMgmtIdlFactory);
        this._notificationsActor = this.createActor<NotificationsService>(agent, notificationsId, notificationsIdlFactory);
    }

    public get chatsClient() : ChatsService {
        return this._chatsActor;
    }

    public get p2pClient() : P2pService {
        return this._p2pActor;
    }

    public get userMgmtClient() : UserMgmtService {
        return this._userMgmtActor;
    }

    public get notificationsClient() : NotificationsService {
        return this._notificationsActor;
    }

    public static get current() : Option<CanisterClientFactory> {
        return (window as any).canisterClientFactory;
    }

    public static set current(value: Option<CanisterClientFactory>) {
        (window as any).canisterClientFactory = value;
    }

    private createActor<T>(agent: Agent, canisterId: Principal, factory: any) : T {
        return Actor.createActor<T>(factory, {
            agent,
            canisterId,
        });
    }
}
